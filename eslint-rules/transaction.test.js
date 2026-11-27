import { createTester } from './test-utils.js'
import plugin from './transaction.js'

const tester = createTester()

tester.run('transaction/use-with-transaction', plugin.rules['use-with-transaction'], {
  valid: [
    { code: 'const result = withTransaction(db, async (tx) => ok(1))' },
    { code: 'const fn = helpers.transaction' },
  ],
  invalid: [
    {
      code: 'const result = db.transaction(async (tx) => ok(1))',
      errors: [{ messageId: 'rawTransaction' }],
    },
    {
      code: 'const result = this.client.transaction(fn)',
      errors: [{ messageId: 'rawTransaction' }],
    },
  ],
})
