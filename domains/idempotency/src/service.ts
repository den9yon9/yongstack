import { createHash } from 'node:crypto'

import { type DbClient, type DbTransaction, schema, withTransaction } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, eq } from 'drizzle-orm'

export type IdempotencyError = 'IDEMPOTENCY_MISMATCH' | 'IDEMPOTENCY_IN_PROGRESS'

const TTL_MS = 24 * 60 * 60 * 1000

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

// 幂等执行(单事务语义): 占位、业务写(handler 内)、结果回填发生在同一个事务里。
//
// - 崩溃 → 事务整体回滚, 不存在"已执行副作用但占位未完成"的窗口, 重试是干净的重新执行。
// - 并发 → 用 INSERT ON CONFLICT DO NOTHING 抢占(绝不在事务中途抛错, 避免事务被置为
//   aborted): 竞争方尚未提交时本插入会等待其提交/回滚; 对方提交则让位, 对方回滚
//   则由自己占位执行。让位方随后读回 completed 记录返回缓存结果。
// - 响应回填含 statusCode/body, 重试时直接返回缓存。
//
// 约束: handler 只允许 DB 写(外部副作用走 outbox/queue, 由 worker 异步投递并幂等),
// 且业务校验尽量放在调用 withIdempotency 之前, handler 内不返回业务错误。
export async function withIdempotency(
  input: IdempotencyInput,
  client: DbClient,
  handler: (tx: DbTransaction) => Promise<IdempotentResult>,
): Promise<Result<IdempotentResult, IdempotencyError>> {
  return withTransaction(client, async (tx) => {
    // 抢占占位: 冲突时静默让位(返回行数为 0), 不触发语句错误(事务不中断)
    const placed = await tx
      .insert(schema.idempotencyKeys)
      .values({
        scope: input.scope,
        key: input.key,
        userId: input.userId ?? null,
        requestHash: input.requestHash,
        status: 'in_progress',
        expiresAt: new Date(Date.now() + TTL_MS),
      })
      .onConflictDoNothing({
        target: [schema.idempotencyKeys.scope, schema.idempotencyKeys.key],
      })
      .returning()

    if (placed.length > 0) {
      // 抢占成功: 执行业务写并回填, 全程在同一事务内
      const result = await handler(tx)
      await tx
        .update(schema.idempotencyKeys)
        .set({ status: 'completed', statusCode: result.statusCode, responseBody: result.body })
        .where(
          and(
            eq(schema.idempotencyKeys.scope, input.scope),
            eq(schema.idempotencyKeys.key, input.key),
          ),
        )
      return ok(result)
    }

    // 让位: 并发事务已占位并已提交(或遗留持锁状态), 读取其结果
    const existing = await findRecord(input, tx)
    if (!existing) return err('IDEMPOTENCY_IN_PROGRESS')
    if (existing.requestHash !== input.requestHash) return err('IDEMPOTENCY_MISMATCH')
    if (existing.status === 'completed') return completedResponse(existing)
    // 单事务语义下占位崩溃即回滚; 出现遗留 in_progress 意味外部写入, 拒绝执行保护数据。
    return err('IDEMPOTENCY_IN_PROGRESS')
  })
}
