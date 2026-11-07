# 本地新手上手

## 两条命令

```bash
pnpm bootstrap
pnpm dev
```

- `pnpm bootstrap`：第一次运行，负责装依赖、生成 `.env`、启动本地基础设施、建 bucket、迁移数据库。
- `pnpm dev`：日常启动全部服务。

## 前置条件

| 工具   | 版本                                                        |
| ------ | ----------------------------------------------------------- |
| Bun    | >= 1.2，推荐 1.3.x（CI 用 1.3.14）                          |
| Node   | >= 22                                                       |
| pnpm   | 10.7.x                                                      |
| Docker | Docker Desktop / OrbStack / Colima，需支持 `docker compose` |

macOS / Linux 直接使用；Windows 建议 WSL2。

## `pnpm bootstrap` 做了什么

1. 检查 Bun / Node / pnpm；默认 Docker 模式还会检查 Docker。
2. 没有 `.env` 就从 `.env.example` 创建，并生成 `SESSION_SECRET`。
3. 执行 `pnpm install`。
4. 启动 `postgres`、`redis`、`seaweedfs`（或使用已有服务）。
5. 执行 `pnpm storage:init` 创建媒体 bucket。
6. 执行 `db:migrate`。
7. 执行 `db:seed`，按 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 创建或更新管理员。
8. 打印访问地址。

重复执行是安全的：不会覆盖已有有效配置，只补缺失项；bucket 初始化、迁移与管理员 seed 都是幂等的（seed 会按 `.env` 同步管理员密码）。

## 启动后访问

| 地址                       | 说明             |
| -------------------------- | ---------------- |
| http://localhost:5173      | 客户端前端       |
| http://localhost:5174      | 管理后台         |
| http://localhost:3000/docs | 客户端 API 文档  |
| http://localhost:3001/docs | 后台 API 文档    |
| http://localhost:3100      | worker 健康/指标 |
| http://localhost:8333      | 本地对象存储     |

管理员账号由 bootstrap seed（默认 `admin@example.com` / `admin123456`，见 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`）。
普通用户可在 `/register` 自行注册。当前尚无业务数据。

## 常用参数

```bash
pnpm bootstrap                     # Docker 起 PG/Redis/SeaweedFS
pnpm bootstrap --no-docker         # 使用 .env 里已经配置好的服务
pnpm bootstrap --external-storage  # 用 R2/COS，跳过 SeaweedFS 和 storage:init
pnpm bootstrap --reset             # 删除本地 Docker 数据卷后重来（二次确认）
pnpm bootstrap --check-only        # 只检查环境，不改任何东西
```

也可以直接用脚本：

```bash
bun scripts/dev-bootstrap.ts --help
```

## 没有 Docker 怎么办

两种选择：

1. 安装 Docker Desktop / OrbStack / Colima，然后重新执行 `pnpm bootstrap`。
2. 自己准备 Postgres、Redis、S3 兼容存储，配置 `.env` 后执行：

```bash
pnpm bootstrap --no-docker
```

## 测试与 e2e

```bash
pnpm test   # 需要 postgres + redis（TESTING_* 配置）
pnpm e2e    # 需要 postgres + redis + SeaweedFS，且首次需安装 Playwright 浏览器
pnpm --filter @yongstack/e2e exec playwright install chromium
```

## 常见问题

| 现象                      | 处理                                                            |
| ------------------------- | --------------------------------------------------------------- |
| 5432/6379/8333 端口被占用 | 停掉已有服务，或 `pnpm bootstrap --no-docker` 复用已有实例      |
| 存储 bucket 不存在        | `pnpm storage:init`                                             |
| 数据库表缺失              | `pnpm --filter @yongstack/database db:migrate`                  |
| `.env` 缺少新变量         | 重新执行 `pnpm bootstrap`，会从 `.env.example` 补齐缺失项       |
| e2e 浏览器未安装          | `pnpm --filter @yongstack/e2e exec playwright install chromium` |
