import type { EdenData, EdenListItem } from '@yongstack/eden-client'

import type { api } from './client'

export type AdminUser = EdenData<typeof api.auth.me.get>
export type SettingItem = EdenData<typeof api.admin.settings.get>['items'][number]

export type AdminUserListItem = EdenListItem<typeof api.admin.users.get>
export type AdminRole = EdenListItem<typeof api.admin.roles.get>

export type AdminFile = EdenListItem<typeof api.admin.files.get>

export type AdminAuditLog = EdenListItem<typeof api.admin.audit.get>

export type AdminOutboxEvent = EdenListItem<typeof api.admin.outbox.get>
export type AdminOutboxStats = EdenData<typeof api.admin.outbox.stats.get>
export type AdminQueue = EdenListItem<typeof api.admin.queues.get>

export interface AdminQueueJob {
  id: string | null
  name: string
  state: string
  attemptsMade: number
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
  failedReason: string | null
}

export interface AdminQueueJobDetail extends AdminQueueJob {
  data: unknown
  opts: Record<string, unknown>
  stacktrace: string[]
  returnvalue: unknown
}

export type AdminQueueScheduler = AdminQueue['schedulers'][number]
