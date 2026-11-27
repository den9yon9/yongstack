import plugin from './i18n.js'
import { createTester } from './test-utils.js'

const tester = createTester()

tester.run('i18n/marker-literal', plugin.rules['marker-literal'], {
  valid: [
    { code: "i18n('File too large')" },
    { code: "translate('zh-CN', 'File too large')" },
    { code: 'const marker = i18n' },
  ],
  invalid: [
    {
      code: 'i18n(message)',
      errors: [{ messageId: 'dynamic' }],
    },
    {
      code: 'translate(locale, message)',
      errors: [{ messageId: 'dynamic' }],
    },
    {
      code: "i18n('File ' + reason)",
      errors: [{ messageId: 'dynamic' }],
    },
    {
      code: 'i18n(`File ${reason}`)',
      errors: [{ messageId: 'dynamic' }],
    },
  ],
})

tester.run('i18n/no-cjk-literal', plugin.rules['no-cjk-literal'], {
  valid: [
    { code: "const message = 'File too large'" },
    // detail 是 OpenAPI 开发者文档, 整棵子树豁免
    { code: "const route = { detail: { description: '中文说明', summary: '中文' } }" },
    { code: "const route = { detail: { nested: { deep: '中文' } } }" },
  ],
  invalid: [
    {
      code: "const message = '文件过大'",
      errors: [{ messageId: 'cjk' }],
    },
    {
      code: 'const message = `文件${name}`',
      errors: [{ messageId: 'cjk' }],
    },
    {
      code: "const route = { summary: '中文' }",
      errors: [{ messageId: 'cjk' }],
    },
  ],
})

tester.run('i18n/no-core-import', plugin.rules['no-core-import'], {
  valid: [
    { code: "import { err } from '@yongstack/shared'" },
    { code: "import { useI18n } from '@yongstack/i18n-web'" },
  ],
  invalid: [
    {
      code: "import { translate } from '@yongstack/i18n'",
      errors: [{ messageId: 'coreImport' }],
    },
    {
      code: "import { normalizeLocale } from '@yongstack/i18n/locale'",
      errors: [{ messageId: 'coreImport' }],
    },
  ],
})
