import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Ban, Loader2, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, type ReceiptDetail } from '@/lib/api'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/stores/auth-store'
import { useSavePricing, useVoidReceipt } from '../api/hooks'
import { SourceBadge, StatusBadge } from './badges'
import { fmtMoney, fmtPrice, fmtTime } from '../lib/format'

export function ReceiptDetailView({ receipt }: { receipt: ReceiptDetail }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isLeader = user?.role === 'leader' || user?.role === 'admin'
  const voidMut = useVoidReceipt()
  const savePricing = useSavePricing()

  const [editing, setEditing] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      receipt.items.map((i) => [
        String(i.id),
        i.unit_price !== null ? String(i.unit_price) : (receipt.suggestions[String(i.id)]?.price ?? '').toString(),
      ])
    )
  )
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hasPriced = receipt.items.some((i) => i.unit_price !== null)
  const total = receipt.items.reduce((sum, i) => sum + (i.unit_price ?? 0) * i.qty, 0)

  const save = async () => {
    try {
      const res = await savePricing.mutateAsync({ receipt_id: receipt.id, prices })
      setEditing(false)
      if (res.status === 'priced') navigate({ to: '/inbound' })
    } catch {
      /* hook 已提示 */
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='icon' asChild>
            <Link to='/inbound'>
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              入库单 {receipt.receipt_no || `#${receipt.id}`}
            </h2>
            <div className='mt-1 flex items-center gap-2'>
              <StatusBadge status={receipt.status} />
              <SourceBadge source={receipt.source} />
            </div>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {receipt.status !== 'void' && !hasPriced && (
            <Button variant='outline' asChild>
              <Link to='/inbound/$id/edit' params={{ id: String(receipt.id) }}>
                <Pencil /> 编辑单据
              </Link>
            </Button>
          )}
          {receipt.status === 'void' ? (
            <Button
              variant='outline'
              onClick={() => voidMut.mutate({ id: receipt.id, restore: true })}
              disabled={voidMut.isPending}
            >
              <RotateCcw /> 恢复为待定价
            </Button>
          ) : (
            isLeader && (
              <Button variant='outline' className='text-destructive' onClick={() => setConfirmVoid(true)}>
                <Ban /> 作废
              </Button>
            )
          )}
          {user?.role === 'admin' && (
            <Button variant='outline' className='text-destructive' onClick={() => setConfirmDelete(true)}>
              <Trash2 /> 删除
            </Button>
          )}
        </div>
      </div>

      <div className='grid gap-4 lg:grid-cols-[320px_1fr]'>
        <Card className='h-fit'>
          <CardHeader>
            <CardTitle className='text-base'>单据信息</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <Row k='入库日期' v={receipt.receipt_date || '—'} />
            <Row k='单号' v={receipt.receipt_no || '—'} />
            <Row k='供应商' v={receipt.supplier || '—'} />
            <Row k='录入人' v={receipt.clerk || '—'} />
            <Row k='明细金额合计' v={fmtMoney(total)} />
            <Row k='备注' v={receipt.note || '—'} />
            {receipt.image_paths.length > 0 && (
              <>
                <Separator />
                <div className='space-y-2'>
                  <div className='text-muted-foreground text-xs'>原始单据</div>
                  <div className='flex flex-wrap gap-2'>
                    {receipt.image_paths.map((p) => (
                      <a key={p} href={`/uploads/${p}`} target='_blank' rel='noreferrer'>
                        <img
                          src={`/uploads/${p}`}
                          alt='单据照片'
                          className='h-28 rounded-lg border object-cover transition hover:opacity-90'
                        />
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex-row items-center justify-between space-y-0'>
            <CardTitle className='text-base'>物料明细</CardTitle>
            {isLeader && receipt.status !== 'void' && (
              <div className='flex gap-2'>
                {editing ? (
                  <>
                    <Button size='sm' variant='ghost' onClick={() => setEditing(false)}>
                      取消
                    </Button>
                    <Button size='sm' onClick={save} disabled={savePricing.isPending}>
                      {savePricing.isPending ? <Loader2 className='animate-spin' /> : <Save />}
                      保存价格
                    </Button>
                  </>
                ) : (
                  <Button size='sm' variant='outline' onClick={() => setEditing(true)}>
                    <Pencil /> {hasPriced ? '改价' : '录入单价'}
                  </Button>
                )}
              </div>
            )}
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
                    <TableHead className='text-right'>单价</TableHead>
                    <TableHead className='text-right'>金额</TableHead>
                    <TableHead>定价人</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.items.map((i, idx) => {
                    const sug = receipt.suggestions[String(i.id)]
                    const shownPrice = editing ? prices[String(i.id)] : i.unit_price
                    const amount = Number(shownPrice || 0) * i.qty
                    return (
                      <TableRow key={i.id}>
                        <TableCell className='text-muted-foreground'>{idx + 1}</TableCell>
                        <TableCell className='text-muted-foreground'>{i.category || '—'}</TableCell>
                        <TableCell className='font-medium'>{i.name}</TableCell>
                        <TableCell className='text-muted-foreground'>{i.spec || '—'}</TableCell>
                        <TableCell className='text-muted-foreground'>{i.attr || '—'}</TableCell>
                        <TableCell className='text-right'>{i.qty}</TableCell>
                        <TableCell className='text-muted-foreground'>{i.unit || '—'}</TableCell>
                        <TableCell className='text-right'>
                          {editing ? (
                            <div className='flex flex-col items-end gap-1'>
                              <Input
                                className='h-8 w-24 text-right'
                                inputMode='decimal'
                                value={prices[String(i.id)] ?? ''}
                                onChange={(e) =>
                                  setPrices((v) => ({ ...v, [String(i.id)]: e.target.value }))
                                }
                              />
                              {sug && (
                                <span className='text-muted-foreground text-[11px]'>
                                  上次 {fmtPrice(sug.price)}（{fmtTime(sug.priced_at)} {sug.priced_by}）
                                </span>
                              )}
                            </div>
                          ) : i.unit_price !== null ? (
                            fmtPrice(i.unit_price)
                          ) : sug ? (
                            <span className='text-muted-foreground'>参考 {fmtPrice(sug.price)}</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className='text-right font-medium'>
                          {shownPrice ? fmtMoney(amount) : '—'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {i.priced_by ? (
                            <div>
                              <div>{i.priced_by}</div>
                              <div className='text-[11px]'>{fmtTime(i.priced_at)}</div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>{i.note || ''}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {!editing && isLeader && receipt.status === 'pending_pricing' && (
              <div className='text-muted-foreground px-4 pt-3 text-xs'>
                点右上「录入单价」填价；也可到「待定价」页批量处理。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title='作废这张单据？'
        desc='作废后不计入导出，可再恢复。'
        confirmText='作废'
        destructive
        handleConfirm={() => voidMut.mutate({ id: receipt.id })}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title='彻底删除这张单据？'
        desc='删除后无法恢复（仅管理员可操作）。'
        confirmText='删除'
        destructive
        handleConfirm={async () => {
          try {
            await api.del(`/receipts/${receipt.id}`)
            toast.success('已删除')
            navigate({ to: '/inbound' })
          } catch (e) {
            toast.error(e instanceof Error ? e.message : '删除失败')
          }
        }}
      />
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className='flex items-baseline justify-between gap-3'>
      <span className='text-muted-foreground shrink-0 text-xs'>{k}</span>
      <span className='text-right font-medium'>{v}</span>
    </div>
  )
}
