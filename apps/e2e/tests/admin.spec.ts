import { expect, test } from '@playwright/test'

const apiBase = 'http://localhost:3001'

test('管理后台渲染', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Nestup 管理后台')).toBeVisible()
  await expect(page.getByText('API 正常')).toBeVisible()
  await expect(page.getByRole('heading', { name: '房源管理' })).toBeVisible()
})

test('admin-api 健康检查', async ({ request }) => {
  const res = await request.get(`${apiBase}/health`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
})

test('admin-api 元信息', async ({ request }) => {
  const res = await request.get(`${apiBase}/info`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ service: 'nestup-admin-api' })
})
