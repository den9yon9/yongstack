import { expect, test } from '@playwright/test'

const apiBase = 'http://localhost:3001'

test('未登录访问管理端会跳转登录页', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Yongstack 管理后台' })).toBeVisible()
})

test('管理员登录 → 控制台 → 退出', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('admin123456')
  await page.getByRole('button', { name: '登录' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Yongstack 管理后台')).toBeVisible()
  await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible()
  await expect(page.getByText('API 正常')).toBeVisible()

  await page.getByRole('button', { name: '退出' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('普通用户不能登录管理端', async ({ request, page }) => {
  const email = `admin-customer-${Date.now()}@example.com`
  const registered = await request.post('http://localhost:3000/auth/register', {
    data: { name: 'Customer', email, password: 'password123' },
  })
  expect(registered.status()).toBe(201)

  await page.goto('/login')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill('password123')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('不是管理员账号')).toBeVisible()
})

test('admin-api 健康检查', async ({ request }) => {
  const res = await request.get(`${apiBase}/health`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
})

test('管理员可以查看并保存运行时设置', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('admin123456')
  await page.getByRole('button', { name: '登录' }).click()

  await page.getByRole('link', { name: '设置' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: '运行时设置' })).toBeVisible()
  await expect(page.getByText('app.name')).toBeVisible()

  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('保存成功')).toBeVisible()
})

test('管理员可查看用户与角色页面', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('admin123456')
  await page.getByRole('button', { name: '登录' }).click()

  await page.getByRole('link', { name: '用户', exact: true }).click()
  await expect(page).toHaveURL(/\/users$/)
  await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索邮箱或昵称')).toBeVisible()

  await page.getByRole('link', { name: '角色', exact: true }).click()
  await expect(page).toHaveURL(/\/roles$/)
  await expect(page.getByRole('heading', { name: '角色权限' })).toBeVisible()
  await expect(page.getByText('全部权限')).toBeVisible()

  await page.getByRole('link', { name: '文件', exact: true }).click()
  await expect(page).toHaveURL(/\/files$/)
  await expect(page.getByRole('heading', { name: '文件管理' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索 key / mime / purpose')).toBeVisible()

  await page.getByRole('link', { name: '审计', exact: true }).click()
  await expect(page).toHaveURL(/\/audit-logs$/)
  await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible()
})
