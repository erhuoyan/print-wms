/**
 * WMS API 客户端：统一 fetch 封装（带 cookie 会话、错误归一化）。
 * 后端 FastAPI 出 JSON；401 时前端跳登录。
 */
import { toast } from 'sonner'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    headers:
      init.body instanceof FormData
        ? undefined
        : { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  if (res.status === 401) {
    if (!location.pathname.startsWith('/sign-in')) {
      location.href = '/sign-in'
    }
    throw new ApiError(401, '登录已过期，请重新登录')
  }
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`
    try {
      const data = await res.json()
      if (typeof data?.detail === 'string') detail = data.detail
      else if (Array.isArray(data?.detail)) detail = data.detail.map((d: any) => d.msg).join('；')
    } catch {
      /* 非 JSON 响应，用默认文案 */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') || ''
  return (type.includes('application/json') ? await res.json() : (await res.blob())) as T
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T>(p: string, fd: FormData) => request<T>(p, { method: 'POST', body: fd }),
}

/** 触发浏览器下载（导出 Excel 用） */
export function download(path: string) {
  const a = document.createElement('a')
  a.href = `${BASE}${path}`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 统一错误提示 */
export function toastError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  toast.error(msg)
}

// ---------- 类型 ----------

export type Role = 'clerk' | 'leader' | 'admin'

export interface User {
  id: number
  username: string
  display_name: string
  role: Role
  role_label: string
}

export interface Meta {
  user: User
  categories: string[]
  units: string[]
  item_names: string[]
}

export interface ReceiptItem {
  id: number
  seq: number
  category: string
  name: string
  spec: string
  attr: string
  qty: number
  unit: string
  unit_price: number | null
  priced_by: string
  priced_at: string
  note: string
}

export interface ReceiptSummary {
  id: number
  receipt_no: string
  receipt_date: string
  supplier: string
  status: 'pending_pricing' | 'priced' | 'void'
  source: 'manual' | 'ocr'
  clerk: string
  item_count: number
  priced_count: number
  total_amount: number | null
}

export interface ReceiptDetail {
  id: number
  receipt_no: string
  receipt_date: string
  supplier: string
  status: ReceiptSummary['status']
  source: ReceiptSummary['source']
  clerk: string
  note: string
  image_paths: string[]
  items: ReceiptItem[]
  suggestions: Record<string, { price: number; priced_at: string; priced_by: string }>
}

export interface PriceRow {
  id: number
  category: string
  name: string
  spec: string
  attr: string
  unit_price: number
  receipt_id: number | null
  priced_by: string
  priced_at: string
}

export interface OcrResult {
  images: string[]
  lines: { text: string; box: number[]; score: number }[]
  guess: {
    receipt_no: string
    receipt_date: string
    supplier: string
    items: Partial<ReceiptItem>[]
    raw: string[]
  }
}
