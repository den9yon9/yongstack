import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'

import { securityHeaders } from './securityHeaders'

function buildApp(isProduction = false) {
  return new Elysia().use(securityHeaders(isProduction)).get('/', () => ({ ok: true }))
}

const url = 'http://localhost/'

describe('securityHeaders', () => {
  test('sets baseline headers including Permissions-Policy', async () => {
    const res = await buildApp().handle(new Request(url))

    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()')
  })

  test('adds HSTS only in production', async () => {
    const dev = await buildApp(false).handle(new Request(url))
    const prod = await buildApp(true).handle(new Request(url))

    expect(dev.headers.get('strict-transport-security')).toBeNull()
    expect(prod.headers.get('strict-transport-security')).toContain('max-age=31536000')
  })
})
