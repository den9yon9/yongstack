import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'bun:test'
import { RuleTester } from 'eslint'

// RuleTester 默认自带 describe/it; 接到 bun:test 上, 让规则测试进统一 runner。
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

export function createTester({ typescript = false } = {}) {
  return new RuleTester({
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ...(typescript ? { parser: tsParser } : {}),
    },
  })
}
