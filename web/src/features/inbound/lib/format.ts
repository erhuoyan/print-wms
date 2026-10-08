/** 金额格式化：整数不带小数、有小数最多两位 */
export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

/** 数量：整数不带小数 */
export function fmtQty(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number.isInteger(v) ? String(v) : String(v)
}

/** 单价展示：去掉多余的 0（5200.0 → 5200） */
export function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return Number.isInteger(v) ? String(v) : String(v)
}

/** 时间只保留到分钟 */
export function fmtTime(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 16)
}
