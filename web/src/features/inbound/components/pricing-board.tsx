import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Loader2, Save } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { api, type ReceiptDetail } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useReceipts, useSavePricing } from '../api/hooks'
import { fmtMoney, fmtPrice, fmtTime } from '../lib/format'

/** 待定价总览：每张单一个卡片，历史价预填，改动即时算金额 */
export function PricingBoard() {
  const { data, isLoading } = useReceipts('pending_pricing')
  const rows = data?.rows ?? []

  const details = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['receipt', r.id],
      queryFn: () => api.get<ReceiptDetail>(`/receipts/${r.id}`),
      enabled: rows.length > 0,
    })),
  })

  if (isLoading) {
    return (
      <div className='text-muted-foreground flex h-40 items-center justify-center gap-2'>
        <Loader2 className='animate-spin' /> 加载中…
      </div>
    )
  }

  if (!rows.length) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center gap-2 py-16'>
          <CheckCircle2 className='size-10 text-emerald-500' />
          <div className='text-lg font-medium'>没有待定价的单据</div>
          <div className='text-muted-foreground text-sm'>所有入库单都已完成定价</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Badge variant='secondary'>{rows.length} 张待定价</Badge>
        <span className='text-muted-foreground text-sm'>
          历史价已预填（同物料最近一次成交价），改成本次价格即可；全部填完自动转「已定价」。
        </span>
      </div>
      {details.map((q) =>
        q.data ? <PricingCard key={q.data.id} receipt={q.data} /> : null
      )}
    </div>
  )
}

function PricingCard({ receipt }: { receipt: ReceiptDetail }) {
  const saveMut = useSavePricing()
  const [prices, setPrices] = useState<Record<string, string>>({})

  useEffect(() => {
    setPrices(
      Object.fromEntries(
        receipt.items.map((i) => [String(i.id), (receipt.suggestions[String(i.id)]?.price ?? '').toString()])
      )
    )
  }, [receipt])

  const total = receipt.items.reduce((sum, i) => {
    const p = Number(prices[String(i.id)] || 0)
    return sum + p * i.qty
  }, 0)
  const filled = receipt.items.filter((i) => Number(prices[String(i.id)] || 0) > 0).length

  return (
    <Card>
      <CardHeader className='flex-row flex-wrap items-center justify-between gap-2 space-y-0'>
        <div>
          <CardTitle className='flex items-center gap-2 text-base'>
            {receipt.receipt_no || `#${receipt.id}`}
            <Badge variant='secondary'>{receipt.clerk || '—'}</Badge>
          </CardTitle>
          <div className='text-muted-foreground mt-1 flex flex-wrap gap-x-4 text-xs'>
            <span>{receipt.receipt_date || '—'}</span>
            <span>{receipt.supplier || '（无供应商）'}</span>
            <span>
              已填 {filled}/{receipt.items.length}
            </span>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <div className='text-right'>
            <div className='text-muted-foreground text-xs'>本单金额</div>
            <div className='text-lg font-semibold'>{fmtMoney(total)}</div>
          </div>
          <Button asChild size='sm' variant='outline'>
            <Link to='/inbound/$id' params={{ id: String(receipt.id) }}>
              查看
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className='px-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8'>#</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>品名</TableHead>
                <TableHead>规格</TableHead>
                <TableHead>属性</TableHead>
                <TableHead className='text-right'>数量</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className='w-56'>单价（历史价已预填）</TableHead>
                <TableHead className='text-right'>金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.items.map((i, idx) => {
                const sug = receipt.suggestions[String(i.id)]
                const p = Number(prices[String(i.id)] || 0)
                return (
                  <TableRow key={i.id}>
                    <TableCell className='text-muted-foreground'>{idx + 1}</TableCell>
                    <TableCell className='text-muted-foreground'>{i.category || '—'}</TableCell>
                    <TableCell className='font-medium'>{i.name}</TableCell>
                    <TableCell className='text-muted-foreground'>{i.spec || '—'}</TableCell>
                    <TableCell className='text-muted-foreground'>{i.attr || '—'}</TableCell>
                    <TableCell className='text-right'>{i.qty}</TableCell>
                    <TableCell className='text-muted-foreground'>{i.unit || '—'}</TableCell>
                    <TableCell>
                      <Input
                        className='h-9'
                        inputMode='decimal'
                        placeholder='填单价'
                        value={prices[String(i.id)] ?? ''}
                        onChange={(e) => setPrices((v) => ({ ...v, [String(i.id)]: e.target.value }))}
                      />
                      {sug && (
                        <div className='text-muted-foreground mt-1 text-[11px]'>
                          上次 {fmtPrice(sug.price)}（{fmtTime(sug.priced_at)} {sug.priced_by}）
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='text-right font-medium'>{p > 0 ? fmtMoney(p * i.qty) : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className='mt-3 flex items-center gap-3 px-4'>
          <Button
            onClick={() => saveMut.mutate({ receipt_id: receipt.id, prices })}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? <Loader2 className='animate-spin' /> : <Save />}
            保存定价
          </Button>
          <span className='text-muted-foreground text-xs'>
            可部分填价先保存，剩余明细留待下次（定价人会记为你当前账号）
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
