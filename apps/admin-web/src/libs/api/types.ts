import type { EdenData } from '@yongstack/eden-client'

import type { api } from './client'

export type AdminUser = EdenData<typeof api.auth.me.get>
export type SettingItem = EdenData<typeof api.admin.settings.get>['items'][number]
