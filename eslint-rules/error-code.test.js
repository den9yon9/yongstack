import plugin from './error-code.js'
import { createTester } from './test-utils.js'

const tester = createTester()

tester.run('error-code/screaming-snake', plugin.rules['screaming-snake'], {
  valid: [
    { code: "const result = err('SKU_NOT_FOUND')" },
    { code: 'const result = err(result.error)' },
    { code: 'const result = err()' },
  ],
  invalid: [
    {
      code: "const result = err('skuNotFound')",
      errors: [{ messageId: 'badFormat', data: { code: 'skuNotFound' } }],
    },
    {
      code: "const result = err('')",
      errors: [{ messageId: 'badFormat' }],
    },
  ],
})
