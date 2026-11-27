import { createTester } from './test-utils.js'
import plugin from './type-boundaries.js'

const tester = createTester({ typescript: true })

tester.run('type-boundaries/no-infra-type-import', plugin.rules['no-infra-type-import'], {
  valid: [
    // 非 infrastructure 包的 type import
    { code: "import type { DbClient } from '@yongstack/database'" },
    // 值导入由 boundaries 规则负责, 本规则只查 type 导入
    { code: "import { Redis } from '@yongstack/redis'" },
    { code: "import type { Local } from './local'" },
  ],
  invalid: [
    {
      code: "import type { Redis } from '@yongstack/redis'",
      errors: [{ messageId: 'noInfraTypeImport', data: { source: '@yongstack/redis' } }],
    },
    {
      code: "export type { Queue } from '@yongstack/queue'",
      errors: [{ messageId: 'noInfraTypeImport' }],
    },
    // 内联写法同样属于 type-only 导入
    {
      code: "import { type Redis, createRedisClient } from '@yongstack/redis'",
      errors: [{ messageId: 'noInfraTypeImport' }],
    },
    {
      code: "export { type Redis } from '@yongstack/redis'",
      errors: [{ messageId: 'noInfraTypeImport' }],
    },
  ],
})
