import { useSyncExternalStore } from 'react'

import { api } from './client'
import type { AuthUser } from './types'

// 轻量会话 store: Header/受保护页面共享登录态。
// localStorage 仅作展示快照, 服务端会话仍以 HttpOnly cookie 为准;
// 受保护页 beforeLoad 会强制 refreshSession 校验。
const SESSION_CACHE_KEY = 'yongstack.session.user'

let current: AuthUser | null | undefined = readCachedSession()
let sessionVersion = 0
const listeners = new Set<() => void>()

function readCachedSession(): AuthUser | null | undefined {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return undefined
  }
}

function persist(value: AuthUser | null) {
  try {
    if (value === null) localStorage.removeItem(SESSION_CACHE_KEY)
    else localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(value))
  } catch {
    // 存储不可用时静默降级, 不影响会话本身
  }
}

function notify() {
  listeners.forEach((fn) => fn())
}

function subscribeSession(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSession(): AuthUser | null | undefined {
  return current
}

export function useSession(): AuthUser | null | undefined {
  return useSyncExternalStore(subscribeSession, getSession)
}

export async function refreshSession(): Promise<AuthUser | null> {
  const requestVersion = sessionVersion
  const res = await api.auth.me.get()
  // 请求期间发生了登录/退出: 丢弃旧响应, 避免把新状态覆盖回去
  if (sessionVersion !== requestVersion) return current ?? null
  current = res.error === null ? res.data : null
  persist(current)
  notify()
  return current
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const res = await api.auth.register.post({ name, email, password })
  if (res.error !== null) {
    return { user: null, error: res.error.value.message ?? '注册失败' }
  }
  sessionVersion += 1
  current = res.data
  persist(current)
  notify()
  return { user: res.data, error: null }
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const res = await api.auth.login.post({ email, password })
  if (res.error !== null) {
    return { user: null, error: res.error.value.message ?? '登录失败' }
  }
  sessionVersion += 1
  current = res.data
  persist(current)
  notify()
  return { user: res.data, error: null }
}

export async function logout(): Promise<void> {
  // 本地优先: UI 立即退出, 服务端销毁失败也不会卡住登录态
  sessionVersion += 1
  current = null
  persist(current)
  notify()
  try {
    await api.auth.logout.post({} as never)
  } catch {
    // 残余 cookie 由后续 401 兜底
  }
}

export async function requestPhoneCode(phone: string): Promise<{ error: string | null }> {
  const res = await api.auth.phone['request-code'].post({ phone })
  if (res.error !== null) return { error: res.error.value.message ?? '发送验证码失败' }
  return { error: null }
}

export async function loginWithPhone(
  phone: string,
  code: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const res = await api.auth.phone.login.post({ phone, code })
  if (res.error !== null) {
    return { user: null, error: res.error.value.message ?? '登录失败' }
  }
  sessionVersion += 1
  current = res.data
  persist(current)
  notify()
  return { user: res.data, error: null }
}

export async function requestPhoneBindCode(phone: string): Promise<{ error: string | null }> {
  const res = await api.auth.phone.bind['request-code'].post({ phone })
  if (res.error !== null) return { error: res.error.value.message ?? '发送验证码失败' }
  return { error: null }
}

export async function bindPhone(phone: string, code: string): Promise<{ error: string | null }> {
  const res = await api.auth.phone.bind.post({ phone, code })
  if (res.error !== null) return { error: res.error.value.message ?? '绑定失败' }
  await refreshSession()
  return { error: null }
}

export async function unbindPhone(): Promise<{ error: string | null }> {
  const res = await api.auth.phone.delete(undefined)
  if (res.error !== null) return { error: res.error.value.message ?? '解绑失败' }
  await refreshSession()
  return { error: null }
}
