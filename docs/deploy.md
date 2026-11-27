# 单机生产部署

面向单机单副本的模块化单体部署：Docker Compose + Caddy 自动 TLS。

## 前置条件

- 一台 Linux 主机（建议 2C4G 起），安装 Docker + Compose
- 两个域名（app / admin）A 记录指向主机公网 IP
- 开放 80/443；PostgreSQL/Redis 不对公网暴露

## 首次部署

```bash
cp .env.production.example .env.production
chmod 600 .env.production
# 编辑 .env.production: 域名、POSTGRES_PASSWORD、SESSION_SECRET、SMTP、STORAGE_* 等
```

关键点：

- `DATABASE_URL` 的主机名必须是 compose 服务名 `postgres`
- `REDIS_SESSION_URL` / `REDIS_QUEUE_URL` 分别指向 `redis-session` / `redis-queue`：
  session+限流与 BullMQ 必须分实例，避免一套全局 `maxmemory-policy` 同时服务两种持久性要求
- Redis 内存上限在 `docker/docker-compose.prod.yml` 里按部署规格调整（默认 session 256MB /
  queue 512MB；queue 必须 `noeviction`）；调大前先看 `RedisMemoryHigh` 告警与主机余量
- `CORS_ORIGIN` 填两个前端域名，用逗号分隔
- `STORAGE_UPLOAD_ORIGIN` 填 `STORAGE_ENDPOINT` 的 **origin**（R2 形如
  `https://<account-id>.r2.cloudflarestorage.com`）：前端 CSP 的 `connect-src`
  靠它放行浏览器直传；不要填 `STORAGE_PUBLIC_BASE_URL`（那是读图域名）。缺失时
  web 容器启动即失败
- `TRUST_PROXY=true`（Caddy 在前面）
- `STORAGE_*` 使用 R2/COS 等生产对象存储，不要用本地 SeaweedFS
- `SESSION_SECRET` 至少 32 位随机字符串

启动：

```bash
pnpm prod:up
```

## 同源反代约束

拓扑是 `Caddy → web 容器(nginx) → API`：浏览器只看到 `app.example.com` /
`admin.example.com`，非 HTML 请求由 web 容器的 nginx 反代到 `API_UPSTREAM`，
所以前后端是**同源**的。

Session cookie 使用 `SameSite=Strict`，并且没有 CSRF token。**如果把 API 拆到
独立域名，登录会静默失败**（跨站请求不再携带 cookie），同时需要重新设计 CSRF 防护。
compose 里的 `API_UPSTREAM` 这一层就是同源约束的实现，不要绕过它直连 API。

Compose 会按依赖顺序启动 PostgreSQL/Redis → 迁移 → API/worker → web → Caddy。首次启动 Caddy 会自动申请证书。

创建首个管理员（复用 migrate 镜像执行 seed 脚本）：

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml \
  run --rm --entrypoint bun migrate scripts/seed.ts
```

前提：`.env.production` 里设置 `ADMIN_EMAIL` / `ADMIN_PASSWORD`（密码至少 12 位）。

## 日常运维

```bash
pnpm prod:logs                 # 跟随全部日志
docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps
curl -f https://app.example.com/health/ready
```

监控/告警栈（Prometheus + Alertmanager + Grafana）作为可选 profile 启动：

```bash
pnpm prod:observability
```

- Grafana: `http://127.0.0.1:3005`（仅本机，建议 SSH 隧道访问）
- Prometheus: `http://127.0.0.1:9090`
- Alertmanager: `http://127.0.0.1:9093`
- 告警通知渠道在 `monitoring/alertmanager.yml` 配置后重启 alertmanager

## 升级

```bash
pnpm db:backup                 # 先备份
git pull
pnpm prod:up --build           # 重新构建并滚动重启(单机即重建容器)
```

迁移与 RBAC 默认权限同步都在 `migrate` one-shot 服务中执行（`db:migrate` + `seed.ts --rbac-only`），API/worker 会等待其完成后启动。新增默认权限/角色后无需手动 seed 管理员。

## 回滚

1. 停止业务容器：`pnpm prod:down`
2. 用备份恢复数据库：`bun scripts/db-restore.ts backups/<file>.dump --yes`
3. 切回上一个版本代码：`git checkout <previous-tag>`
4. `pnpm prod:up --build`

> Drizzle 没有 down migration；回滚以数据库备份为准。生产变更遵循 expand/contract：先加列/双写，再切读，最后删旧列。

## 安全清单

- `.env.production` 权限 600，不提交仓库
- 只暴露 80/443；PostgreSQL/Redis 无宿主机端口
- 生产关闭 `/docs`（代码已按 `NODE_ENV` 控制）
- 配置 `SENTRY_DSN` 接收异常
- 配置 Alertmanager 通知渠道并定期演练
