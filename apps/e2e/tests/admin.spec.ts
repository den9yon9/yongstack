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
  await page.getByRole('button', { name: '登录', exact: true }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Yongstack 管理后台' })).toBeVisible()
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
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('无后台访问权限')).toBeVisible()
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
  await page.getByRole('button', { name: '登录', exact: true }).click()

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
  await page.getByRole('button', { name: '登录', exact: true }).click()

  await page.getByRole('link', { name: '用户', exact: true }).click()
  await expect(page).toHaveURL(/\/users$/)
  await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索邮箱或昵称')).toBeVisible()

  await page.getByRole('link', { name: '角色', exact: true }).click()
  await expect(page).toHaveURL(/\/roles$/)
  await expect(page.getByRole('heading', { name: '角色权限' })).toBeVisible()
  await expect(page.getByText('全部权限')).toBeVisible()

  await page.getByRole('link', { name: '媒体资源', exact: true }).click()
  await expect(page).toHaveURL(/\/files$/)
  await expect(page.getByRole('heading', { name: '媒体资源' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索 key / mime / purpose')).toBeVisible()

  await page.getByRole('link', { name: '审计', exact: true }).click()
  await expect(page).toHaveURL(/\/audit-logs$/)
  await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible()
})

test('管理员可查看队列运维页', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('admin123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()

  await page.getByRole('link', { name: '队列运维' }).click()
  await expect(page).toHaveURL(/\/queues$/)
  await expect(page.getByRole('heading', { name: '队列运维' })).toBeVisible()
  await expect(page.getByText('email', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'failed' })).toBeVisible()
})

test('角色页支持新建角色入口', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('admin123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()

  await page.getByRole('link', { name: '角色', exact: true }).click()
  await expect(page).toHaveURL(/\/roles$/)
  await expect(page.getByRole('button', { name: '新建角色' })).toBeVisible()
  await expect(page.getByText(/内置角色只读/)).toBeVisible()
  await expect(page.getByRole('button', { name: '复制为自定义角色' }).first()).toBeVisible()
})

const E2E_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test('媒体资源 presign → PUT → confirm → 列表 → 删除', async ({ request }) => {
  const login = await request.post(`${apiBase}/auth/login`, {
    data: { email: 'admin@example.com', password: 'admin123456' },
  })
  expect(login.status()).toBe(200)
  const cookie = (login.headers()['set-cookie'] ?? '').split(';')[0]

  const presigned = await request.post(`${apiBase}/admin/files/presign`, {
    headers: { cookie },
    data: { filename: 'e2e.png', mime: 'image/png', size: 3 },
  })
  expect(presigned.status()).toBe(201)
  const upload = (await presigned.json()) as {
    fileId: string
    key: string
    uploadUrl: string
    headers: Record<string, string>
  }

  const put = await request.put(upload.uploadUrl, {
    headers: upload.headers,
    data: Buffer.from([1, 2, 3]),
  })
  expect(put.status()).toBe(200)

  const confirmed = await request.post(`${apiBase}/admin/files/${upload.fileId}/confirm`, {
    headers: { cookie },
    data: {},
  })
  expect(confirmed.status()).toBe(200)

  const listed = await request.get(`${apiBase}/admin/files?page=1&pageSize=20`, {
    headers: { cookie },
  })
  expect(listed.status()).toBe(200)
  const body = (await listed.json()) as { items: { id: string; key: string }[] }
  expect(body.items.some((item) => item.key === upload.key)).toBe(true)

  const removed = await request.delete(`${apiBase}/admin/files/${upload.fileId}`, {
    headers: { cookie },
  })
  expect(removed.status()).toBe(204)
})

test('管理员可在媒体资源页上传图片', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('admin@example.com')
  await page.getByLabel('密码').fill('admin123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()

  await page.getByRole('link', { name: '媒体资源', exact: true }).click()
  await expect(page).toHaveURL(/\/files$/)

  await page.locator('input[type="file"]').setInputFiles({
    name: 'e2e-upload.png',
    mimeType: 'image/png',
    buffer: E2E_PNG,
  })

  await expect(page.getByText('上传成功')).toBeVisible({ timeout: 20_000 })
})
