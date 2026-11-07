import { createHash } from 'node:crypto'

import { type DbClient, schema } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, eq } from 'drizzle-orm'

export type IdempotencyError = 'IDEMPOTENCY_MISMATCH'

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

export async function withIdempotency(
  input: IdempotencyInput,
  client: DbClient,
  handler: () => Promise<IdempotentResult>,
): Promise<Result<IdempotentResult, IdempotencyError>> {
  const existing = await findRecord(input, client)
  if (existing) {
    if (existing.requestHash !== input.requestHash) return err('IDEMPOTENCY_MISMATCH')
    return ok({ statusCode: existing.statusCode, body: existing.responseBody })
  }

  const result = await handler()

  try {
    await client.insert(schema.idempotencyKeys).values({
      scope: input.scope,
      key: input.key,
      userId: input.userId ?? null,
      requestHash: input.requestHash,
      statusCode: result.statusCode,
      responseBody: result.body,
      expiresAt: new Date(Date.now() + TTL_MS),
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    // 并发请求已写入: 以先写入的记录为准
    const raced = await findRecord(input, client)
    if (raced && raced.requestHash !== input.requestHash) return err('IDEMPOTENCY_MISMATCH')
  }

  return ok(result)
}
