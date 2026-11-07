import type { EdenData } from '@yongstack/eden-client'

import type { api } from './client'

export type AuthUser = EdenData<typeof api.auth.me.get>
export type SessionItem = EdenData<typeof api.auth.sessions.get>['items'][number]
