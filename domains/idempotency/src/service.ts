import { createHash } from 'node:crypto'

import { type DbClient, schema } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, eq, lt } from 'drizzle-orm'

export type IdempotencyError = 'IDEMPOTENCY_MISMATCH' | 'IDEMPOTENCY_IN_PROGRESS'

const TTL_MS = 24 * 60 * 60 * 1000
// 占位�认定的最大时长: 超过后视为持有者已崩溃, 其他请求可抢占重来。
// 需大于业务 handler 的最坏耗时(含网络/发信队列写入), 又远小于用户重试间隔。
const IN_PROGRESS_TIMEOUT_MS = 60 * 1000

export interface IdempotencyInput {
  scope: string
  key: string
  userId?: string | null
  requestHash: string
}

export interface IdempotentResult {
  statusCode: number
  body: Record<string, unknown>
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

export function hashIdempotencyRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function findRecord(input: IdempotencyInput, client: DbClient) {
  const [row] = await client
    .select()
    .from(schema.idempotencyKeys)
    .where(
      and(eq(schema.idempotencyKeys.scope, input.scope), eq(schema.idempotencyKeys.key, input.key)),
    )
  return row
}

type IdempotencyRecord = Awaited<ReturnType<typeof findRecord>>

function completedResponse(record: IdempotencyRecord): Result<IdempotentResult, IdempotencyError> {
  // in_progress 记录不可能走到这里(调用方先判状态), 类型上仍保证非空。
  if (record.status !== 'completed' || record.statusCode === null || record.responseBody === null) {
    return err('IDEMPOTENCY_MISMATCH')
  }
  return ok({ statusCode: record.statusCode, body: record.responseBody })
}

export async function withIdempotency(
  input: IdempotencyInput,
  client: DbClient,
  handler: () => Promise<IdempotentResult>,
): Promise<Result<IdempotentResult, IdempotencyError>> {
  const existing = await findRecord(input, client)
  if (existing) {
    if (existing.requestHash !== input.requestHash) return err('IDEMPOTENCY_MISMATCH')
    if (existing.status === 'completed') return completedResponse(existing)

    // in_progress: 未超时则让客户端稍后重试, 超时则尝试接管
    const age = Date.now() - existing.createdAt.getTime()
    if (age < IN_PROGRESS_TIMEOUT_MS) return err('IDEMPOTENCY_IN_PROGRESS')

    const takeover = await client
      .update(schema.idempotencyKeys)
      .set({ createdAt: new Date(), expiresAt: new Date(Date.now() + TTL_MS) })
      .where(
        and(
          eq(schema.idempotencyKeys.scope, input.scope),
          eq(schema.idempotencyKeys.key, input.key),
          eq(schema.idempotencyKeys.status, 'in_progress'),
          lt(schema.idempotencyKeys.createdAt, new Date(Date.now() - IN_PROGRESS_TIMEOUT_MS)),
        ),
      )
      .returning({ key: schema.idempotencyKeys.key })
    if (takeover.length === 0) return err('IDEMPOTENCY_IN_PROGRESS')

    return runHandler(input, client, handler)
  }

  // 先占位再执行: 唯一键保证并发请求只有一个真正运行 handler,
  // 其余请求在占位提交后要么拿到缓存结果, 要么收到 IN_PROGRESS。
  try {
    await client.insert(schema.idempotencyKeys).values({
      scope: input.scope,
      key: input.key,
      userId: input.userId ?? null,
      requestHash: input.requestHash,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + TTL_MS),
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    // 并发请求已占位/完成: 与请求头对应则等待/复用, 否则拒绝
    const raced = await findRecord(input, client)
    if (raced) {
      if (raced.requestHash !== input.requestHash) return err('IDEMPOTENCY_MISMATCH')
      if (raced.status === 'completed') return completedResponse(raced)
    }
    return err('IDEMPOTENCY_IN_PROGRESS')
  }

  return runHandler(input, client, handler)
}

// 占位成功后执行 handler 并回填响应; 失败时删除占位, 允许客户端重试。
async function runHandler(
  input: IdempotencyInput,
  client: DbClient,
  handler: () => Promise<IdempotentResult>,
): Promise<Result<IdempotentResult, IdempotencyError>> {
  let result: IdempotentResult
  try {
    result = await handler()
  } catch (error) {
    await client
      .delete(schema.idempotencyKeys)
      .where(
        and(
          eq(schema.idempotencyKeys.scope, input.scope),
          eq(schema.idempotencyKeys.key, input.key),
          eq(schema.idempotencyKeys.status, 'in_progress'),
        ),
      )
    throw error
  }

  await client
    .update(schema.idempotencyKeys)
    .set({ status: 'completed', statusCode: result.statusCode, responseBody: result.body })
    .where(
      and(eq(schema.idempotencyKeys.scope, input.scope), eq(schema.idempotencyKeys.key, input.key)),
    )
  return ok(result)
}
