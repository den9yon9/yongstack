import plugin from './cross-domain-read.js'
import { createTester } from './test-utils.js'

const tester = createTester()

const domainFile = (domain, file = 'service.ts') => `/repo/domains/${domain}/src/${file}`
const appFile = (app, file = 'routes/x.ts') => `/repo/apps/${app}/src/${file}`

tester.run('cross-domain-read/no-cross-domain-refs', plugin.rules['no-cross-domain-refs'], {
  valid: [
    {
      filename: domainFile('user'),
      code: 'db.select().from(schema.users)',
    },
    {
      // 不是 schema 上的引用
      filename: domainFile('user'),
      code: 'const users = payload.users',
    },
    {
      filename: '/repo/packages/database/src/index.ts',
      code: 'schema.files',
    },
  ],
  invalid: [
    {
      filename: domainFile('user'),
      code: 'db.select().from(schema.files)',
      errors: [
        { messageId: 'crossDomainRead', data: { table: 'files', owner: 'file', domain: 'user' } },
      ],
    },
    {
      filename: domainFile('user'),
      code: 'db.query.files.findMany()',
      errors: [
        { messageId: 'crossDomainRead', data: { table: 'files', owner: 'file', domain: 'user' } },
      ],
    },
    {
      filename: appFile('app-api'),
      code: 'db.select().from(schema.users)',
      errors: [{ messageId: 'appTableRef', data: { table: 'users' } }],
    },
    {
      filename: appFile('app-api'),
      code: 'db.query.users.findMany()',
      errors: [{ messageId: 'appTableRef', data: { table: 'users' } }],
    },
  ],
})
