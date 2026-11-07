import { expect, test } from '@playwright/test'

const apiBase = 'http://localhost:3000'

test('首页渲染工程底座', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Yongstack' })).toBeVisible()
  await expect(page.getByText('领域无关的全栈应用模板')).toBeVisible()
  await expect(page.getByText('API 正常')).toBeVisible()
})

test('app-api 健康检查', async ({ request }) => {
  const res = await request.get(`${apiBase}/health`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
})

test('app-api 元信息', async ({ request }) => {
  const res = await request.get(`${apiBase}/info`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ service: 'yongstack-app-api' })
})

test('app-api 指标端点', async ({ request }) => {
  const res = await request.get(`${apiBase}/metrics`)
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('http_requests_total')
})

test('worker 健康检查', async ({ request }) => {
  const res = await request.get('http://localhost:3100/health')
  expect(res.status()).toBe(200)
  expect(await res.text()).toBe('ok')
})

test('注册 → 自动登录 → 刷新保持 → 退出', async ({ page }) => {
  const email = `user-${Date.now()}@example.com`

  await page.goto('/register')
  await page.getByLabel('昵称').fill('测试用户')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel(/密码/).fill('password123')
  await page.getByRole('button', { name: '注册' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: '测试用户' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: '测试用户' })).toBeVisible()

  await page.getByRole('button', { name: '退出' }).click()
  await expect(page.getByRole('link', { name: '登录' })).toBeVisible()
})

test('登录页显示错误密码提示', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('ghost@example.com')
  await page.getByLabel('密码').fill('wrong-password')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('邮箱或密码错误')).toBeVisible()
})

test('个人中心需要登录并可退出', async ({ page }) => {
  await page.goto('/me')
  await expect(page).toHaveURL(/\/login$/)

  const email = `me-${Date.now()}@example.com`
  await page.goto('/register')
  await page.getByLabel('昵称').fill('个人中心用户')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel(/密码/).fill('password123')
  await page.getByRole('button', { name: '注册' }).click()

  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('link', { name: '个人中心用户' }).click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByText('普通用户')).toBeVisible()
})
