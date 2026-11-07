import { describe, expect, test } from 'bun:test'
import { Elysia, status } from 'elysia'

import { localePlugin } from './localePlugin'

function buildApp(defaultLocale: 'en' | 'zh-CN' = 'en') {
  return new Elysia()
    .use(localePlugin({ defaultLocale }))
    .get('/missing', ({ i18n }) =>
      status(404, { error: 'UNAUTHORIZED', message: i18n('Unauthorized') }),
    )
    .get('/uncatalogued', ({ i18n }) =>
      status(400, { error: 'X', message: i18n('Some brand new sentence') }),
    )
}

const url = (path: string) => `http://localhost${path}`

describe('localePlugin', () => {
  test('injects a translator that mirrors the english source by default', async () => {
    const res = await buildApp().handle(new Request(url('/missing')))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'UNAUTHORIZED', message: 'Unauthorized' })
  })

  test('translates via Accept-Language', async () => {
    const res = await buildApp().handle(
      new Request(url('/missing'), { headers: { 'accept-language': 'zh-CN,zh;q=0.9' } }),
    )
    expect(await res.json()).toMatchObject({ message: '未登录或登录已过期' })
  })

  test('X-Locale header overrides Accept-Language', async () => {
    const res = await buildApp().handle(
      new Request(url('/missing'), {
        headers: { 'accept-language': 'en-US,en;q=0.9', 'x-locale': 'zh-CN' },
      }),
    )
    expect(await res.json()).toMatchObject({ message: '未登录或登录已过期' })
  })

  test('honours the configured default locale', async () => {
    const res = await buildApp('zh-CN').handle(new Request(url('/missing')))
    expect(await res.json()).toMatchObject({ message: '未登录或登录已过期' })
  })

  test('falls back to the default locale for unsupported Accept-Language', async () => {
    const res = await buildApp().handle(
      new Request(url('/missing'), { headers: { 'accept-language': 'fr-FR,fr;q=0.9' } }),
    )
    expect(await res.json()).toMatchObject({ message: 'Unauthorized' })
  })

  test('returns the source untouched when it is not catalogued', async () => {
    const res = await buildApp().handle(
      new Request(url('/uncatalogued'), { headers: { 'accept-language': 'zh-CN' } }),
    )
    expect(await res.json()).toMatchObject({ message: 'Some brand new sentence' })
  })
})
