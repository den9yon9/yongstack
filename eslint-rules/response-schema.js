// ESLint 本地插件: 强制 domains/*/src/model.ts 的响应/入参 schema 为白名单。
//
// 背景: 从表 schema 整行派生(`table.select.x`)或按黑名单排除(`Type.Omit(...)`)时,
// 新增列默认会进入 API 契约; Elysia 又按 response schema 序列化, 于是新字段会静默
// 出现在 JSON 与前端 Eden 类型里。本规则只放行 `Type.Pick` / 显式 `Type.Object`,
// 让“新增字段默认不可见, 暴露必须改 schema”从口头约定变成 CI 约束。
//
// 范围: 只查 domains/*/src/model.ts (由 eslint.config.js 的 files 限定);
// packages/database/src/model.ts 的基线 Omit 属于后续 schema 拆分范围, 有意不覆盖。
'use strict'

const DATABASE_PACKAGE = '@yongstack/database'
const TYPEBOX_PACKAGE = '@sinclair/typebox'
const ROW_KINDS = new Set(['select', 'insert', 'update'])

function staticPropertyName(member) {
  if (!member.computed) return member.property.type === 'Identifier' ? member.property.name : null
  return member.property.type === 'Literal' && typeof member.property.value === 'string'
    ? member.property.value
    : null
}

// 匹配 <table>.<select|insert|update>.<name>
function matchTableRow(node, tableNames) {
  if (node.type !== 'MemberExpression') return null
  const table = staticPropertyName(node)
  const base = node.object
  if (base.type !== 'MemberExpression') return null
  const kind = staticPropertyName(base)
  if (kind === null || !ROW_KINDS.has(kind)) return null
  const root = base.object
  if (root.type !== 'Identifier' || !tableNames.has(root.name)) return null
  return { kind, table: table ?? '<computed>' }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce allowlist DTO schemas (Type.Pick / Type.Object) in domain model.ts instead of whole-row table schemas or Type.Omit blacklists',
    },
    schema: [],
    messages: {
      wholeRow:
        '`table.{{kind}}.{{table}}` derives the whole row: new columns would leak into the API contract. Use an explicit allowlist, e.g. `Type.Pick(table.{{kind}}.{{table}}, [...])` (or `Type.Object({ ... })` for inputs).',
      omitBlacklist:
        '`Type.Omit(table.{{kind}}.{{table}}, ...)` is a blacklist: new columns are exposed by default. Use `Type.Pick(...)` or an explicit `Type.Object({ ... })` instead.',
    },
  },
  create(context) {
    const tableNames = new Set()
    const typeNames = new Set()

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (source !== DATABASE_PACKAGE && source !== TYPEBOX_PACKAGE) return

        const wanted = source === DATABASE_PACKAGE ? 'table' : 'Type'
        const target = source === DATABASE_PACKAGE ? tableNames : typeNames
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue
          const imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : String(specifier.imported.value)
          if (imported === wanted) target.add(specifier.local.name)
        }
      },
      VariableDeclarator(node) {
        if (node.init === null) return
        const hit = matchTableRow(node.init, tableNames)
        if (hit === null) return
        context.report({
          node: node.init,
          messageId: 'wholeRow',
          data: { kind: hit.kind, table: hit.table },
        })
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') return
        if (staticPropertyName(callee) !== 'Omit') return
        const owner = callee.object
        if (owner.type !== 'Identifier' || !typeNames.has(owner.name)) return

        const first = node.arguments[0]
        if (first === undefined) return
        const hit = matchTableRow(first, tableNames)
        if (hit === null) return
        context.report({
          node: first,
          messageId: 'omitBlacklist',
          data: { kind: hit.kind, table: hit.table },
        })
      },
    }
  },
}

export default { rules: { allowlist: rule } }
