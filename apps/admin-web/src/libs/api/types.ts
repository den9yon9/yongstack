import type { EdenData } from '@nestup/eden-client'

import type { api } from './client'

export type AdminUser = EdenData<typeof api.auth.me.get>
