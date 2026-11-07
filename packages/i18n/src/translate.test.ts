import { describe, expect, test } from 'bun:test'

import { translate } from './translate'

describe('translate', () => {
  test('returns the english source for the en locale', () => {
    expect(translate('en', 'Unauthorized')).toBe('Unauthorized')
  })

  test('returns the zh-CN translation when catalogued', () => {
    expect(translate('zh-CN', 'Unauthorized')).toBe('未登录或登录已过期')
  })

  test('falls back to the english source when uncatalogued', () => {
    expect(translate('zh-CN', 'Not a catalogued sentence')).toBe('Not a catalogued sentence')
  })

  test('interpolates {placeholder} params', () => {
    expect(translate('en', 'Hello, {name}!', { name: 'Sam' })).toBe('Hello, Sam!')
    expect(translate('zh-CN', 'Hello, {name}!', { name: '小明' })).toBe('Hello, 小明!')
  })
})
