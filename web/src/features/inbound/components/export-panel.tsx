import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const COLUMNS = [
  '入库单号',
  '入库日期',
  '供应商',
  '物料类别',
  '品名',
  '规格',
  '属性',
  '数量',
  '单位',
  '单价',
  '金额',
  '录入人',
  '定价人',
  '定价时间',
  '状态',
  '明细备注',
  '单据备注',
  '来源',
]

export function ExportPanel() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [status, setStatus] = useState('priced')
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (start) qs.set('start', start)
    if (end) qs.set('end', end)
    qs.set('status', status)
    try {
      // 先探测是否有数据（导出接口无数据时 404），有数据再触发下载
      const res = await fetch(`/api/export?${qs.toString()}`, { credentials: 'same-origin' })
      if (res.status === 404) {
        toast.error('所选范围内没有可导出的明细')
        return
      }
      if (!res.ok) {
        let msg = `导出失败 (${res.status})`
        try {
          const d = await res.json()
          if (typeof d?.detail === 'string') msg = d.detail
        } catch {
          /* ignore */
        }
        toast.error(msg)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0, 10)
      a.download = `入库登记_${stamp}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('已生成 Excel')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='grid gap-4 lg:grid-cols-[1fr_320px]'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>生成 Excel</CardTitle>
          <p className='text-muted-foreground text-xs'>
            导出后直接把内容粘贴 / 导入到现有系统，不用再逐条敲。
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>开始日期</Label>
              <Input type='date' value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>结束日期</Label>
              <Input type='date' value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>导出范围</Label>
              <select
                className='border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm'
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value='priced'>已定价（推荐）</option>
                <option value='pending_pricing'>仅待定价</option>
                <option value='priced,pending_pricing'>全部（含待定价）</option>
              </select>
            </div>
          </div>
          <Button onClick={run} disabled={loading} size='lg'>
            {loading ? <Loader2 className='animate-spin' /> : <FileDown />} 生成并下载
          </Button>
        </CardContent>
      </Card>

      <Card className='h-fit'>
        <CardHeader>
          <CardTitle className='text-base'>表格包含的列</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-1.5'>
            {COLUMNS.map((c) => (
              <Badge key={c} variant='secondary'>
                {c}
              </Badge>
            ))}
          </div>
          <p className='text-muted-foreground mt-4 text-xs'>
            要调整列顺序 / 列名：改后端 <code className='bg-muted rounded px-1'>app/modules/inbound/exporter.py</code>{' '}
            里的 <code className='bg-muted rounded px-1'>COLUMNS</code>。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
