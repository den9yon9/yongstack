import { expect, test } from '@playwright/test'

const apiBase = 'http://localhost:3000'

test('首页渲染工程底座', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Nestup' })).toBeVisible()
  await expect(page.getByText('面向租房场景的全栈应用骨架')).toBeVisible()
  await expect(page.getByText('API 正常')).toBeVisible()
})

test('storefront-api 健康检查', async ({ request }) => {
  const res = await request.get(`${apiBase}/health`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
})

test('storefront-api 元信息', async ({ request }) => {
  const res = await request.get(`${apiBase}/info`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ service: 'nestup-storefront-api' })
})

test('storefront-api 指标端点', async ({ request }) => {
  const res = await request.get(`${apiBase}/metrics`)
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('http_requests_total')
})

test('worker 健康检查', async ({ request }) => {
  const res = await request.get('http://localhost:3100/health')
  expect(res.status()).toBe(200)
  expect(await res.text()).toBe('ok')
})
