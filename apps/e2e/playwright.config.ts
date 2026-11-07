import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    // 前后端用户可见文案为中文; 浏览器语言会随 Accept-Language 传给 API
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'app',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
      testMatch: /app\.spec\.ts/,
    },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
      testMatch: /admin\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'AUTH_RATE_LIMIT_PER_MINUTE=40 bun --env-file=../../.env src/index.ts',
      cwd: '../app-api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
    },
    {
      command: 'pnpm dev',
      cwd: '../app-web',
      // /@vite/client 在 proxy bypass 白名单内, 不会误入 API
      url: 'http://localhost:5173/@vite/client',
      reuseExistingServer: true,
    },
    {
      command: 'AUTH_RATE_LIMIT_PER_MINUTE=40 bun --env-file=../../.env src/index.ts',
      cwd: '../admin-api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
    },
    {
      command: 'pnpm dev',
      cwd: '../admin-web',
      url: 'http://localhost:5174/@vite/client',
      reuseExistingServer: true,
    },
    {
      command: 'HEALTH_PORT=3100 bun --env-file=../../.env src/index.ts',
      cwd: '../worker',
      url: 'http://localhost:3100/health',
      reuseExistingServer: true,
    },
  ],
})
