import { useSyncExternalStore } from 'react'

import { api } from './client'
import type { AuthUser } from './types'

// 轻量会话 store: Header/受保护页面共享登录态。
// localStorage 仅作展示快照, 服务端会话仍以 HttpOnly cookie 为准;
// 受保护页 beforeLoad 会强制 refreshSession 校验。
const SESSION_CACHE_KEY = 'nestup.session.user'

let current: AuthUser | null | undefined = readCachedSession()
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

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSession(): AuthUser | null | undefined {
  return current
}

export function useSession(): AuthUser | null | undefined {
  return useSyncExternalStore(subscribeSession, getSession)
}

export async function refreshSession(): Promise<AuthUser | null> {
  const res = await api.auth.me.get()
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
  current = res.data
  persist(current)
  notify()
  return { user: res.data, error: null }
}

export async function logout(): Promise<void> {
  try {
    await api.auth.logout.post({} as never)
  } finally {
    current = null
    persist(current)
    notify()
  }
}
