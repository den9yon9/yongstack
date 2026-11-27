import plugin from './invariant-throw.js'
import { createTester } from './test-utils.js'

const tester = createTester()

tester.run('invariant-throw/no-bare-throw', plugin.rules['no-bare-throw'], {
  valid: [
    { code: "throw new InvariantViolation('stock restore failed')" },
    { code: "function f() { return err('STOCK_RESTORE_FAILED') }" },
    { code: "throw new TypeError('not a bare Error')" },
  ],
  invalid: [
    {
      code: "throw new Error('stock restore failed')",
      errors: [{ messageId: 'bareThrow' }],
    },
  ],
})
