import type { Static } from '@sinclair/typebox'
import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { recordOutboxEvent } from '@yongstack/outbox'
import { err, ok, type Result } from '@yongstack/shared'
import { registerUser, type RegisterUserError } from '@yongstack/user'
import type { RegisterInputSchema } from '@yongstack/user/model'

export const USER_REGISTERED_EVENT = 'user.registered'

export async function registerAccount(
  input: Static<typeof RegisterInputSchema>,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<Result<typeof schema.users.$inferSelect, RegisterUserError>> {
  return withTransaction(client, async (tx) => {
    const result = await registerUser(input, tx, opts)
    if (result.isErr()) return err(result.error)

    const user = result.value
    await recordOutboxEvent(tx, {
      type: USER_REGISTERED_EVENT,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
      },
    })
    return ok(user)
  })
}
