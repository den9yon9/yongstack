# 备份与恢复

## 策略

- **每日全量备份**：生产 compose 的 `backup` 服务用 `pg_dump --format=custom` 导出到 `backups` 卷
- **保留期**：`BACKUP_RETENTION_DAYS`（默认 14 天）
- **验证**：每次备份后立即 `pg_restore --list`，损坏文件会被删除
- **Redis**：开启 AOF；Redis 只保存在线会话/限流/队列状态，outbox 事件在 PostgreSQL 中，Redis 丢失不会丢业务事件

## 手动备份

```bash
# 宿主机需要安装 postgresql-client (pg_dump/pg_restore)
export DATABASE_URL=postgres://...
pnpm db:backup
# 输出: ./backups/yongstack-YYYYMMDD-HHmmss.dump
```

可配置：

```bash
BACKUP_DIR=/var/backups/yongstack
BACKUP_RETENTION_DAYS=14
```

## 恢复

恢复到临时库（推荐先演练）：

```bash
export RESTORE_DATABASE_URL=postgres://yongstack:...@localhost:5432/yongstack_restore
bun scripts/db-restore.ts backups/yongstack-20260101-030000.dump
```

恢复到生产（高风险，必须显式确认）：

```bash
export RESTORE_DATABASE_URL=postgres://...
NODE_ENV=production bun scripts/db-restore.ts backups/<file>.dump --yes
```

`pg_restore` 使用 `--clean --if-exists`，会覆盖目标库中同名对象。

## 恢复演练

每月至少一次：

1. 创建空库 `yongstack_restore`
2. 恢复最近备份
3. 抽查用户、outbox、审计记录数量
4. 启动一套临时 API 指向该库，验证 `/health/ready`
5. 删除临时库

## RPO / RTO

- RPO：约 24 小时（每日全量）；如需更低，缩短 `BACKUP_INTERVAL_SECONDS` 或引入 WAL 归档/PITR
- RTO：取决于备份大小与磁盘，一般分钟级

## 异地备份

当前只写本地 `backups` 卷。生产建议二选一：

- 给备份卷挂载到独立磁盘，并用宿主机 cron/rclone 同步到对象存储
- 在 `docker/backup/entrypoint.sh` 中追加 `aws s3 cp`（复用 `STORAGE_*` 凭据）
