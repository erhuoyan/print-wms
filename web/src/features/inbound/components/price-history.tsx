import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { History, Loader2, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/stores/auth-store'
import { useAddPrice, useLatestPrices, useMeta, usePrices } from '../api/hooks'
import { fmtPrice, fmtTime } from '../lib/format'

/**
 * 价格历史：同一物料每次入库价可能不同，这里保留全部记录可回溯。
 * 上方是"每个物料最近一次价"（定价时的参考值），下方是完整流水。
 */
export function PriceHistory() {
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === 'leader' || user?.role === 'admin'
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState({ name: '', category: '' })

  const { data, isLoading } = usePrices(query.name, query.category)
  const latest = useLatestPrices()
  const { data: meta } = useMeta()
  const addMut = useAddPrice()
  const [form, setForm] = useState({ category: '纸张', name: '', spec: '', attr: '', unit_price: '' })

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-2'>
        <div className='space-y-1.5'>
          <Label className='text-xs'>品名</Label>
          <Input
            className='w-48'
            placeholder='搜索品名'
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setQuery({ name, category })}
          />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>类别</Label>
          <select
            className='border-input h-9 rounded-md border bg-transparent px-3 text-sm'
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setQuery({ name, category: e.target.value })
            }}
          >
            <option value=''>全部</option>
            {(meta?.categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => setQuery({ name, category })}>
          <Search /> 查询
        </Button>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <History className='size-4' /> 各物料最近成交价
          </CardTitle>
          <p className='text-muted-foreground text-xs'>定价时按「类别+品名+规格+属性」带出这里的价格作参考。</p>
        </CardHeader>
        <CardContent className='px-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类别</TableHead>
                  <TableHead>品名</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>属性</TableHead>
                  <TableHead className='text-right'>最近价</TableHead>
                  <TableHead>成交时间</TableHead>
                  <TableHead>定价人</TableHead>
                  <TableHead>来源单据</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(latest.data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='text-muted-foreground'>{r.category}</TableCell>
                    <TableCell className='font-medium'>{r.name}</TableCell>
                    <TableCell className='text-muted-foreground'>{r.spec || '—'}</TableCell>
                    <TableCell className='text-muted-foreground'>{r.attr || '—'}</TableCell>
                    <TableCell className='text-right font-semibold'>{fmtPrice(r.unit_price)}</TableCell>
                    <TableCell className='text-muted-foreground'>{fmtTime(r.priced_at)}</TableCell>
                    <TableCell className='text-muted-foreground'>{r.priced_by || '—'}</TableCell>
                    <TableCell>
                      {r.receipt_id ? (
                        <Link
                          to='/inbound/$id'
                          params={{ id: String(r.receipt_id) }}
                          className='text-sm hover:underline'
                        >
                          #{r.receipt_id}
                        </Link>
                      ) : (
                        <span className='text-muted-foreground text-xs'>手工录入</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!latest.data?.rows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className='text-muted-foreground h-24 text-center'>
                      还没有价格记录；完成一次定价后这里会有数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Plus className='size-4' /> 手工补录价格
            </CardTitle>
            <p className='text-muted-foreground text-xs'>用于录入历史价/合同价，作为定价参考；不覆盖已有记录。</p>
          </CardHeader>
          <CardContent>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>类别</Label>
                <select
                  className='border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm'
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {(meta?.categories ?? []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>品名 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>规格</Label>
                <Input
                  placeholder='787x1092'
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>属性</Label>
                <Input placeholder='70g' value={form.attr} onChange={(e) => setForm({ ...form, attr: e.target.value })} />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>单价 *</Label>
                <Input
                  inputMode='decimal'
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
              </div>
            </div>
            <Button
              className='mt-3'
              disabled={addMut.isPending}
              onClick={async () => {
                await addMut.mutateAsync({
                  category: form.category,
                  name: form.name,
                  spec: form.spec,
                  attr: form.attr,
                  unit_price: form.unit_price,
                })
                setForm({ ...form, name: '', spec: '', attr: '', unit_price: '' })
              }}
            >
              {addMut.isPending ? <Loader2 className='animate-spin' /> : <Plus />} 记录价格
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            价格流水
            <Badge variant='outline'>{data?.rows.length ?? 0} 条</Badge>
          </CardTitle>
          <p className='text-muted-foreground text-xs'>每次定价追加一条，保留谁在何时定的什么价。</p>
        </CardHeader>
        <CardContent className='px-0'>
          {isLoading ? (
            <div className='text-muted-foreground flex h-24 items-center justify-center gap-2'>
              <Loader2 className='animate-spin' /> 加载中…
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>类别</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead>属性</TableHead>
                    <TableHead className='text-right'>单价</TableHead>
                    <TableHead>定价人</TableHead>
                    <TableHead>来源单据</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className='text-muted-foreground whitespace-nowrap'>
                        {fmtTime(r.priced_at)}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>{r.category}</TableCell>
                      <TableCell className='font-medium'>{r.name}</TableCell>
                      <TableCell className='text-muted-foreground'>{r.spec || '—'}</TableCell>
                      <TableCell className='text-muted-foreground'>{r.attr || '—'}</TableCell>
                      <TableCell className='text-right font-semibold'>{fmtPrice(r.unit_price)}</TableCell>
                      <TableCell className='text-muted-foreground'>{r.priced_by || '—'}</TableCell>
                      <TableCell>
                        {r.receipt_id ? (
                          <Link
                            to='/inbound/$id'
                            params={{ id: String(r.receipt_id) }}
                            className='text-sm hover:underline'
                          >
                            #{r.receipt_id}
                          </Link>
                        ) : (
                          <span className='text-muted-foreground text-xs'>手工录入</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.rows.length && (
                    <TableRow>
                      <TableCell colSpan={8} className='text-muted-foreground h-24 text-center'>
                        没有匹配的记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
