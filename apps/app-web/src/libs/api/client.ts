import { treaty } from '@elysiajs/eden'
import type { App } from '@yongstack/app-api'

// base 必须是完整 URL; treaty('') 会补 https:// 前缀导致 //path 被浏览器解析为协议相对 URL
export const api = treaty<App>(window.location.origin)
