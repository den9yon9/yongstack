import { treaty } from '@elysiajs/eden'
import type { App } from '@yongstack/admin-api'

// 与 app-web 同款: base 必须是完整 URL, 同源 cookie 透传
export const api = treaty<App>(window.location.origin)
