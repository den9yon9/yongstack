// ESLint 本地插件: 禁止内核层(domains/usecases)对基础设施包的 type-only 导入。
//
// 背景: eslint-plugin-boundaries 的 dependencies 规则只校验值导入, `import type`
// 会被静默放过——内核反向依赖 infra(BullMQ Queue 类型)不留任何痕迹, 分层约束形同虚设。
// 本规则补上这个盲区: 内核需要基础设施能力时, 依据依赖倒置在内核内定义端口接口,
// 由边缘(apps/worker)注入实现, 而不是让内核直接引用 infra 的类型。
// 值导入已被 boundaries 拦截, 这里只处理 `import type` / `export type ... from`。
'use strict'

// 与 eslint.config.js 的 infrastructure 元素定义保持一致
const INFRA_RE = /^@yongstack\/(session|queue|redis|http|storage|mailer|sms)(\/|$)/

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid type-only imports of infrastructure packages in domains/usecases (define a port instead)',
    },
    messages: {
      noInfraTypeImport:
        'Core layer (domains/usecases) must not type-import infrastructure "{{source}}". Define a port interface inside the usecase and inject the adapter at the edge (apps/worker).',
    },
  },
  create(context) {
    function hasInlineTypeSpecifier(node) {
      if (node.type === 'ImportDeclaration') {
        return node.specifiers.some(
          (specifier) => specifier.type === 'ImportSpecifier' && specifier.importKind === 'type',
        )
      }
      if (node.type === 'ExportNamedDeclaration') {
        return node.specifiers.some(
          (specifier) => specifier.type === 'ExportSpecifier' && specifier.exportKind === 'type',
        )
      }
      return false
    }

    function check(node) {
      // ImportDeclaration: `import type { X } from '...'` (importKind === 'type')
      // ExportAllDeclaration/ExportNamedDeclaration: `export type { X } from '...'`
      // 也要抓内联写法: `import { type X }` / `export { type X }`
      const isTypeOnly = node.importKind === 'type' || node.exportKind === 'type'
      if (!isTypeOnly && !hasInlineTypeSpecifier(node)) return
      if (typeof node.source?.value !== 'string') return
      if (!INFRA_RE.test(node.source.value)) return

      context.report({
        node: node.source,
        messageId: 'noInfraTypeImport',
        data: { source: node.source.value },
      })
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}

export default { rules: { 'no-infra-type-import': rule } }
