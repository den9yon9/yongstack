# 对象存储

媒体资源存放在 S3 兼容对象存储，数据库只保存可公开访问的 URL。上传、读取与 provider 无关，Cloudflare R2、腾讯云 COS、AWS S3、自建 SeaweedFS 共用同一套代码。

## 为什么用 S3 兼容协议

S3 API 是对象存储的事实标准（不是 ISO 标准）。只要服务支持 S3 API，AWS SDK v3 和桶策略/Presigned URL 等能力就可以通用，迁移 provider 时应用代码不需要改。

本项目使用：

- 客户端：`@aws-sdk/client-s3`
- 本地/CI：SeaweedFS S3 gateway（Apache-2.0）
- 生产：Cloudflare R2，后续可切腾讯云 COS
- 公开访问：公有读 bucket + 自定义媒体域名（CDN）

## 环境变量

```env
STORAGE_ENDPOINT=http://localhost:8333
STORAGE_REGION=us-east-1
STORAGE_BUCKET=yongstack
STORAGE_ACCESS_KEY_ID=admin
STORAGE_SECRET_ACCESS_KEY=secret
STORAGE_FORCE_PATH_STYLE=true
STORAGE_PUBLIC_BASE_URL=http://localhost:8333/yongstack
STORAGE_KEY_PREFIX=media
```

生产切换到 R2 时：

```env
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_BUCKET=yongstack
STORAGE_FORCE_PATH_STYLE=false
STORAGE_PUBLIC_BASE_URL=https://img.example.com
```

R2 的 S3 API 不支持对象级 ACL，公开访问通过 Cloudflare 控制台的 Custom Domain（推荐）或 `r2.dev` 开启。`r2.dev` 有速率限制，只适合开发/演示，正式上线前必须配置自定义域名。

## 本地开发

```bash
docker compose -f docker/docker-compose.yml up -d seaweedfs
pnpm storage:init
pnpm dev
```

`pnpm storage:init` 会创建 bucket 并授予匿名只读权限。上传的资源可通过 `STORAGE_PUBLIC_BASE_URL/<key>` 访问。

## 生产迁移到自有域名

1. 在 R2 绑定 `img.yourdomain.com`（CNAME）。
2. 修改 `STORAGE_PUBLIC_BASE_URL=https://img.yourdomain.com`。
3. 业务表落地后，按需用一次性 SQL 或迁移脚本替换数据库中旧 URL 前缀。

## 迁移到腾讯云 COS

1. 用 `rclone` 或 `aws s3 sync` 把对象同步到 COS bucket。
2. 修改 `STORAGE_ENDPOINT`、`STORAGE_REGION`、`STORAGE_BUCKET` 和密钥。
3. 把 `img.yourdomain.com` 的 CDN 源站切到 COS。
4. 数据库 URL 不变，无需迁移。

COS 也支持 S3 兼容 API，少数 header/签名细节与 R2 不同，切换前跑一次上传/读取 e2e。

## 预签名直传（大文件推荐）

服务端不转发文件内容，客户端直接 PUT 到对象存储：

```
POST /files/presign        → { fileId, key, uploadUrl, headers, expiresInSeconds }
  (校验 size / mime，创建 files.status = 'pending')
PUT  uploadUrl             → 客户端直传，headers 必须原样带上
POST /files/:id/confirm    → HEAD 校验对象，files.status = 'ready'，记审计
```

- `uploadUrl` 已签名 `Content-Type` 与 `Cache-Control`，客户端必须发送返回的 `headers`，否则 S3 签名不匹配。
- 预签名路径拿不到文件内容，**不做 magic bytes 校验**；只校验声明的 MIME（已参与签名）。
- 未确认的 pending 记录由 worker 按 `FILE_PENDING_MAX_AGE_MS` 回收对象与行。
- 小文件仍可用 `POST /files`（服务端读取 + magic bytes 校验）。

## 约定

- 对象 key：`media/<uuid>.<ext>`，不使用用户文件名。
- 只允许 JPEG / PNG / WebP，最大 5MB；直传接口会校验 magic bytes，不只信 `Content-Type`。
- 上传时设置 `Cache-Control: public, max-age=31536000, immutable`。
- 媒体资源是公开资源；未来私有文件用 `Storage.presignGet()` 生成短期签名 URL。
- 上传接口只允许登录用户，文件按 owner 隔离。

## 管理端媒体资源

管理端「媒体资源」页是唯一的文件入口：

- 上传：`POST /admin/files/presign` 拿预签名 URL → 浏览器 PUT → `POST /admin/files/:id/confirm`
- 查看：列表展示缩略图、类型、大小、用途；图片弹窗预览，PDF 新窗口打开
- 下载 / 复制公开 URL / 软删除
- 单文件上限沿用 `upload.maxBytes`（默认 5MB）
- 允许类型由 `upload.allowedTypes` 控制（默认 JPEG / PNG / WebP / PDF）
- 权限：`files:read` / `files:write` / `files:delete`

数据库 `files` 表是业务资产事实源；对象存储 bucket 只负责物理文件，不再提供独立的「存储资源」页面。

## 浏览器直传与 CORS

预签名 PUT 由浏览器**直接**发到对象存储域名，不是经过 API，因此 bucket 必须允许前端站点跨域：

- 本地：`pnpm storage:init` 会按 `STORAGE_CORS_ORIGINS`（默认 `http://localhost:5173,http://localhost:5174`）设置 bucket CORS；本地 SeaweedFS compose 也带了 `-s3.allowedOrigins=*` 兜底
- 生产 R2 / COS：在控制台配置 CORS，至少允许 `GET` / `PUT` / `HEAD`，`AllowedHeaders: *`，来源填两个前端域名
- 若管理端上传一直停在「上传中」或浏览器报 `Failed to fetch`，优先检查 bucket CORS 与 `STORAGE_ENDPOINT` 是否可从浏览器访问

> `STORAGE_CORS_ORIGINS` 只在 `storage:init` 时使用，不是运行时变量。修改后重新执行 `pnpm storage:init`（SeaweedFS）或在云控制台保存。
