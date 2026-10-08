import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, FileDown, Hourglass, Inbox, Plus, Ban } from 'lucide-react'
import { type ReceiptSummary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SourceBadge, StatusBadge } from './badges'
import { useReceipts } from '../api/hooks'
import { fmtMoney } from '../lib/format'

const TABS = [
  { key: 'pending_pricing', label: '待定价', icon: Hourglass },
  { key: 'priced', label: '已定价', icon: CheckCircle2 },
  { key: 'void', label: '已作废', icon: Ban },
  { key: 'all', label: '全部', icon: null },
] as const

export function ReceiptsList() {
  const [status, setStatus] = useState<string>('pending_pricing')
  const { data, isLoading } = useReceipts(status)
  const rows: ReceiptSummary[] = data?.rows ?? []
  const counts = data?.counts ?? {}

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='bg-muted/60 inline-flex flex-wrap gap-1 rounded-lg p-1'>
          {TABS.map((t) => {
            const active = status === t.key
            return (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                <span
                  className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${
                    active ? 'bg-primary/10 text-primary' : 'bg-background/70 text-muted-foreground'
                  }`}
                >
                  {counts[t.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link to='/export'>
              <FileDown /> 导出
            </Link>
          </Button>
          <Button asChild>
            <Link to='/inbound/new'>
              <Plus /> 录入新单
            </Link>
          </Button>
        </div>
      </div>

      <Card className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b px-5 py-4'>
          <CardTitle className='text-base'>单据列表</CardTitle>
          <CardDescription>点击单号查看明细并定价</CardDescription>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-muted/50'>
                <TableHead>入库日期</TableHead>
                <TableHead>单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className='text-right'>明细</TableHead>
                <TableHead className='text-right'>已定价</TableHead>
                <TableHead className='text-right'>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>录入人</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className='w-px' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className='text-muted-foreground h-32 text-center'>
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow className='hover:bg-transparent'>
                  <TableCell colSpan={10} className='h-44 text-center'>
                    <Inbox className='text-muted-foreground/40 mx-auto size-10' />
                    <div className='mt-3 font-medium'>这个分类下还没有单据</div>
                    <div className='text-muted-foreground mt-1 text-sm'>
                      点右上角「录入新单」开始，或切换到「全部」查看
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className='group'>
                  <TableCell className='text-muted-foreground tabular-nums whitespace-nowrap'>
                    {r.receipt_date || '—'}
                  </TableCell>
                  <TableCell className='font-medium whitespace-nowrap'>
                    <Link
                      to='/inbound/$id'
                      params={{ id: String(r.id) }}
                      className='hover:text-primary hover:underline'
                    >
                      {r.receipt_no || `#${r.id}`}
                    </Link>
                  </TableCell>
                  <TableCell className='max-w-56 truncate'>{r.supplier || '—'}</TableCell>
                  <TableCell className='text-muted-foreground text-right tabular-nums'>
                    {r.item_count}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    <span className={r.priced_count === r.item_count ? 'text-emerald-600' : 'text-amber-600'}>
                      {r.priced_count}/{r.item_count}
                    </span>
                  </TableCell>
                  <TableCell className='text-right font-medium tabular-nums'>
                    {fmtMoney(r.total_amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className='text-muted-foreground'>{r.clerk || '—'}</TableCell>
                  <TableCell>
                    <SourceBadge source={r.source} />
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button asChild size='sm' variant='ghost' className='opacity-0 group-hover:opacity-100'>
                      <Link to='/inbound/$id' params={{ id: String(r.id) }}>
                        查看
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
