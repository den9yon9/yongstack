import { describe, it } from 'bun:test'
import { RuleTester } from 'eslint'

import plugin from './response-schema.js'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

const IMPORTS = [
  "import { Type } from '@sinclair/typebox'",
  "import { table } from '@yongstack/database'",
  '',
].join('\n')

tester.run('response-schema/allowlist', plugin.rules.allowlist, {
  valid: [
    {
      code: `${IMPORTS}export const UserResponseSchema = Type.Pick(table.select.user, ['id', 'name'])`,
    },
    {
      code: `${IMPORTS}export const CreateInputSchema = Type.Object({ name: Type.String() })`,
    },
    {
      // 不是 @yongstack/database 的 table 绑定, 不应误报
      code: "import { table } from 'some-other-package'\nexport const X = table.select.user",
    },
    {
      // table 只在 Pick 里出现是合法用法
      code: `${IMPORTS}export const X = Type.Intersect([Type.Pick(table.select.user, ['id'])])`,
    },
  ],
  invalid: [
    {
      code: `${IMPORTS}export const UserResponseSchema = table.select.user`,
      errors: [{ messageId: 'wholeRow', data: { kind: 'select', table: 'user' } }],
    },
    {
      code: `${IMPORTS}export const FileResponseSchema = table.select.file`,
      errors: [{ messageId: 'wholeRow', data: { kind: 'select', table: 'file' } }],
    },
    {
      code: `${IMPORTS}export const FileResponseSchema = Type.Omit(table.select.file, ['status'])`,
      errors: [{ messageId: 'omitBlacklist', data: { kind: 'select', table: 'file' } }],
    },
    {
      code: `${IMPORTS}export const RegisterInputSchema = Type.Omit(table.insert.user, ['id'])`,
      errors: [{ messageId: 'omitBlacklist', data: { kind: 'insert', table: 'user' } }],
    },
    {
      // 别名导入也要拦住
      code: "import { table as dbTable } from '@yongstack/database'\nexport const X = dbTable.select.user",
      errors: [{ messageId: 'wholeRow', data: { kind: 'select', table: 'user' } }],
    },
  ],
})
