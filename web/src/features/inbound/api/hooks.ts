import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  api,
  type Meta,
  type OcrResult,
  type PriceRow,
  type ReceiptDetail,
  type ReceiptSummary,
} from '@/lib/api'

// ---------- 元数据（用户/类别/单位） ----------

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => api.get<Meta>('/meta'),
    staleTime: 5 * 60 * 1000,
  })
}

// ---------- 单据 ----------

export function useReceipts(status: string) {
  return useQuery({
    queryKey: ['receipts', status],
    queryFn: () =>
      api.get<{ rows: ReceiptSummary[]; counts: Record<string, number> }>(
        `/receipts?status=${encodeURIComponent(status)}`
      ),
  })
}

export function useReceipt(id: number | undefined) {
  return useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get<ReceiptDetail>(`/receipts/${id}`),
    enabled: !!id,
  })
}

export function useCreateReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<{ id: number }>('/receipts', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['meta'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateReceipt(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put<{ id: number }>(`/receipts/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['receipt', id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useVoidReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, restore }: { id: number; restore?: boolean }) =>
      api.post(`/receipts/${id}/${restore ? 'restore' : 'void'}`),
    onSuccess: (_d, v) => {
      toast.success(v.restore ? '已恢复为待定价' : '单据已作废')
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['receipt', v.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- 定价 ----------

export function useSavePricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { receipt_id: number; prices: Record<string, string> }) =>
      api.post<{ status: string }>('/pricing', payload),
    onSuccess: (d, v) => {
      toast.success(d.status === 'priced' ? '已完成定价' : '已保存，仍有明细未定价')
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['receipt', v.receipt_id] })
      qc.invalidateQueries({ queryKey: ['prices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- OCR ----------

export function useOcr() {
  return useMutation({
    mutationFn: (fd: FormData) => api.upload<OcrResult>('/ocr', fd),
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- 价格历史 ----------

export function usePrices(name = '', category = '') {
  const qs = new URLSearchParams()
  if (name) qs.set('name', name)
  if (category) qs.set('category', category)
  return useQuery({
    queryKey: ['prices', name, category],
    queryFn: () => api.get<{ rows: PriceRow[] }>(`/prices?${qs.toString()}`),
  })
}

export function useLatestPrices() {
  return useQuery({
    queryKey: ['prices', 'latest'],
    queryFn: () => api.get<{ rows: PriceRow[] }>('/prices/latest'),
  })
}

export function useAddPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/prices', payload),
    onSuccess: () => {
      toast.success('已记录价格')
      qc.invalidateQueries({ queryKey: ['prices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- 用户管理（管理员） ----------

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () =>
      api.get<{
        rows: {
          id: number
          username: string
          display_name: string
          role: string
          role_label: string
          active: boolean
          created_at: string
        }[]
      }>('/auth/users'),
  })
}
