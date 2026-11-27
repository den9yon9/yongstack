import plugin from './table-ownership.js'
import { createTester } from './test-utils.js'

const tester = createTester()

const domainFile = (domain, file = 'service.ts') => `/repo/domains/${domain}/src/${file}`
const usecaseFile = (usecase, file = 'service.ts') => `/repo/usecases/${usecase}/src/${file}`
const appFile = (app, file = 'routes/x.ts') => `/repo/apps/${app}/src/${file}`

tester.run('table-ownership/no-cross-domain-tables', plugin.rules['no-cross-domain-tables'], {
  valid: [
    {
      filename: domainFile('user'),
      code: 'db.insert(schema.users).values({ email })',
    },
    {
      // usecase 写自己名下的编排状态表
      filename: usecaseFile('file'),
      code: 'tx.update(schema.files).set({ status })',
    },
    {
      // 只读不写
      filename: domainFile('user'),
      code: 'db.select().from(schema.files)',
    },
    {
      filename: '/repo/packages/database/src/index.ts',
      code: 'db.insert(schema.users).values({})',
    },
  ],
  invalid: [
    {
      filename: domainFile('user'),
      code: 'tx.update(schema.files).set({ status })',
      errors: [
        { messageId: 'crossDomain', data: { table: 'files', owner: 'file', domain: 'user' } },
      ],
    },
    {
      filename: appFile('app-api'),
      code: 'db.delete(schema.users)',
      errors: [{ messageId: 'appWrite', data: { table: 'users' } }],
    },
    {
      filename: usecaseFile('media'),
      code: 'tx.insert(schema.files).values({})',
      errors: [
        { messageId: 'usecaseWrite', data: { table: 'files', owner: 'file', domain: 'media' } },
      ],
    },
    {
      // 数组实参里的每个表都要检查
      filename: domainFile('user'),
      code: 'tx.insert([schema.users, schema.files]).values([])',
      errors: [
        { messageId: 'crossDomain', data: { table: 'files', owner: 'file', domain: 'user' } },
      ],
    },
  ],
})
