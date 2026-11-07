import type { EdenData } from '@nestup/eden-client'

import type { api } from './client'

export type AuthUser = EdenData<typeof api.auth.me.get>
