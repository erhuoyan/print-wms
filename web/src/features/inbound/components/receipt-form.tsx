import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Camera, Image as ImageIcon, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { type ReceiptDetail, type ReceiptItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useCreateReceipt, useMeta, useOcr, useUpdateReceipt } from '../api/hooks'

type DraftItem = {
  category: string
  name: string
  spec: string
  attr: string
  qty: string
  unit: string
  note: string
}

const EMPTY: DraftItem = { category: '纸张', name: '', spec: '', attr: '', qty: '', unit: '令', note: '' }

const today = () => new Date().toISOString().slice(0, 10)

export function ReceiptForm({ receipt }: { receipt?: ReceiptDetail }) {
  const navigate = useNavigate()
  const { data: meta } = useMeta()
  const createMut = useCreateReceipt()
  const updateMut = useUpdateReceipt(receipt?.id ?? 0)
  const ocrMut = useOcr()

  const [receiptNo, setReceiptNo] = useState(receipt?.receipt_no ?? '')
  const [receiptDate, setReceiptDate] = useState(receipt?.receipt_date || today())
  const [supplier, setSupplier] = useState(receipt?.supplier ?? '')
  const [note, setNote] = useState(receipt?.note ?? '')
  const [images, setImages] = useState<string[]>(receipt?.image_paths ?? [])
  const [source, setSource] = useState(receipt?.source ?? 'manual')
  const [items, setItems] = useState<DraftItem[]>(
    receipt?.items?.length
      ? receipt.items.map(toDraft)
      : [{ ...EMPTY }]
  )
  const [ocrText, setOcrText] = useState<string[]>([])

  const setItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const saving = createMut.isPending || updateMut.isPending

  const submit = async () => {
    const payload = {
      receipt_no: receiptNo.trim(),
      receipt_date: receiptDate,
      supplier: supplier.trim(),
      note: note.trim(),
      source,
      image_paths: images,
      items: items.map((i) => ({ ...i, qty: i.qty || 0 })),
    }
    try {
      const res = receipt
        ? await updateMut.mutateAsync(payload)
        : await createMut.mutateAsync(payload)
      toast.success(receipt ? '单据已更新' : '单据已保存，已进入待定价')
      navigate({ to: '/inbound/$id', params: { id: String(res.id) } })
    } catch {
      /* 错误已在 hook 里提示 */
    }
  }

  return (
    <div className='space-y-4'>
      {!receipt && <OcrPanel onResult={applyOcr} ocrMut={ocrMut} />}

      {ocrText.length > 0 && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              识别原文（对照修改用）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className='max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap'>
              {ocrText.join('\n')}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className='grid gap-4 lg:grid-cols-[320px_1fr]'>
        <Card className='h-fit'>
          <CardHeader>
            <CardTitle className='text-base'>单据信息</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Field label='入库日期' required>
              <Input type='date' value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </Field>
            <Field label='单号'>
              <Input
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder='纸质单编号，可留空'
              />
            </Field>
            <Field label='供应商' required>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder='如 金东纸业' />
            </Field>
            <Field label='备注'>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder='选填' />
            </Field>
            {images.length > 0 && (
              <div className='space-y-2'>
                <Label className='text-xs text-muted-foreground'>已附单据照片</Label>
                <div className='flex flex-wrap gap-2'>
                  {images.map((p) => (
                    <div key={p} className='relative'>
                      <img
                        src={`/uploads/${p}`}
                        alt='单据'
                        className='h-16 w-16 rounded border object-cover'
                      />
                      <button
                        type='button'
                        className='absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-white'
                        onClick={() => setImages((v) => v.filter((x) => x !== p))}
                      >
                        <X className='size-3' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex-row items-center justify-between space-y-0'>
            <CardTitle className='text-base'>物料明细</CardTitle>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => setItems((v) => [...v, { ...EMPTY }])}
            >
              <Plus /> 加一行
            </Button>
          </CardHeader>
          <CardContent className='px-0'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-muted-foreground border-b text-left text-xs'>
                    <th className='w-8 px-3 py-2'>#</th>
                    <th className='px-2 py-2'>类别</th>
                    <th className='px-2 py-2'>品名 *</th>
                    <th className='px-2 py-2'>规格</th>
                    <th className='px-2 py-2'>属性</th>
                    <th className='px-2 py-2 text-right'>数量 *</th>
                    <th className='px-2 py-2'>单位</th>
                    <th className='px-2 py-2'>备注</th>
                    <th className='w-10' />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className='border-b last:border-0'>
                      <td className='px-3 py-1.5 text-muted-foreground'>{idx + 1}</td>
                      <td className='px-1 py-1.5'>
                        <ComboInput
                          value={it.category}
                          options={meta?.categories ?? []}
                          onChange={(v) => setItem(idx, { category: v })}
                          className='w-24'
                        />
                      </td>
                      <td className='px-1 py-1.5'>
                        <Input
                          className='h-8 w-36'
                          value={it.name}
                          onChange={(e) => setItem(idx, { name: e.target.value })}
                        />
                      </td>
                      <td className='px-1 py-1.5'>
                        <Input
                          className='h-8 w-28'
                          placeholder='787x1092'
                          value={it.spec}
                          onChange={(e) => setItem(idx, { spec: e.target.value })}
                        />
                      </td>
                      <td className='px-1 py-1.5'>
                        <Input
                          className='h-8 w-20'
                          placeholder='70g'
                          value={it.attr}
                          onChange={(e) => setItem(idx, { attr: e.target.value })}
                        />
                      </td>
                      <td className='px-1 py-1.5'>
                        <Input
                          className='h-8 w-20 text-right'
                          inputMode='decimal'
                          value={it.qty}
                          onChange={(e) => setItem(idx, { qty: e.target.value })}
                        />
                      </td>
                      <td className='px-1 py-1.5'>
                        <ComboInput
                          value={it.unit}
                          options={meta?.units ?? []}
                          onChange={(v) => setItem(idx, { unit: v })}
                          className='w-20'
                        />
                      </td>
                      <td className='px-1 py-1.5'>
                        <Input
                          className='h-8 w-28'
                          value={it.note}
                          onChange={(e) => setItem(idx, { note: e.target.value })}
                        />
                      </td>
                      <td className='px-2 py-1.5'>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='size-8 text-muted-foreground hover:text-destructive'
                          onClick={() =>
                            setItems((v) => (v.length > 1 ? v.filter((_, i) => i !== idx) : [{ ...EMPTY }]))
                          }
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='text-muted-foreground mt-2 px-4 text-xs'>
              类别 / 单位可直接输入新值（会自动记住）；纸张克重填在「属性」列，如 70g
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='flex gap-3'>
        <Button size='lg' onClick={submit} disabled={saving}>
          {saving ? <Loader2 className='animate-spin' /> : <Save />}
          {receipt ? '保存修改' : '保存，送去定价'}
        </Button>
        <Button size='lg' variant='outline' onClick={() => navigate({ to: '/inbound' })}>
          取消
        </Button>
      </div>
    </div>
  )

  function applyOcr(result: {
    images: string[]
    guess: {
      receipt_no: string
      receipt_date: string
      supplier: string
      items: Partial<ReceiptItem>[]
      raw: string[]
    }
  }) {
    const g = result.guess
    if (g.receipt_no) setReceiptNo(g.receipt_no)
    if (g.receipt_date) setReceiptDate(g.receipt_date)
    if (g.supplier) setSupplier(g.supplier)
    setSource('ocr')
    setImages((v) => [...v, ...result.images])
    setOcrText(g.raw)
    if (g.items.length) {
      const drafted: DraftItem[] = g.items.map((i) => ({
        category: i.category || '纸张',
        name: i.name || '',
        spec: i.spec || '',
        attr: i.attr || '',
        qty: i.qty ? String(i.qty) : '',
        unit: i.unit || '令',
        note: i.note || '',
      }))
      setItems((prev) => {
        const keep = prev.filter((p) => p.name.trim() || p.spec.trim())
        return [...keep, ...drafted]
      })
    }
    toast.success(`识别完成：${g.items.length} 行明细已填入，请核对后保存`)
  }
}

function toDraft(i: ReceiptItem): DraftItem {
  return {
    category: i.category,
    name: i.name,
    spec: i.spec,
    attr: i.attr,
    qty: String(i.qty ?? ''),
    unit: i.unit,
    note: i.note,
  }
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1.5'>
      <Label className='text-xs'>
        {label} {required && <span className='text-destructive'>*</span>}
      </Label>
      {children}
    </div>
  )
}

/** 可选可填的下拉：有候选走下拉，没有就手输 */
function ComboInput({
  value,
  options,
  onChange,
  className,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  className?: string
}) {
  if (!options.length) {
    return <Input className={`h-8 ${className}`} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={`h-8 ${className}`}>
        <SelectValue placeholder='选择' />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** 拍照 / 选图 → OCR 回填 */
function OcrPanel({
  onResult,
  ocrMut,
}: {
  onResult: (r: any) => void
  ocrMut: ReturnType<typeof useOcr>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camOpen, setCamOpen] = useState(false)
  const [shots, setShots] = useState<Blob[]>([])

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 2592 }, height: { ideal: 1944 } },
      })
      streamRef.current = stream
      setCamOpen(true)
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      }, 0)
    } catch (e) {
      toast.error(
        '打开摄像头失败：' + (e as Error).message + '（http 页面浏览器会禁用摄像头，请用 localhost 或 https）'
      )
    }
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamOpen(false)
    setShots([])
  }

  const snap = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((b) => b && setShots((v) => [...v, b]), 'image/jpeg', 0.92)
  }

  const recognize = async (files: Blob[], names?: string[]) => {
    const fd = new FormData()
    files.forEach((f, i) => fd.append('files', f, names?.[i] ?? `shot_${Date.now()}_${i}.jpg`))
    const res = await ocrMut.mutateAsync(fd)
    onResult(res)
  }

  return (
    <>
      <Card>
        <CardContent className='flex flex-wrap items-center gap-3 py-4'>
          <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <Camera className='size-5' />
          </div>
          <div className='flex-1'>
            <div className='text-sm font-medium'>拍照识别纸质入库单</div>
            <div className='text-muted-foreground text-xs'>
              高拍仪 / 摄像头拍照，或选手机照片；识别结果自动填到下面表单，识别错的直接改。
            </div>
          </div>
          <Button type='button' onClick={openCamera} disabled={ocrMut.isPending}>
            {ocrMut.isPending ? <Loader2 className='animate-spin' /> : <Camera />} 打开摄像头
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => fileRef.current?.click()}
            disabled={ocrMut.isPending}
          >
            <ImageIcon /> 选择图片
          </Button>
          <input
            ref={fileRef}
            type='file'
            accept='image/*'
            multiple
            className='hidden'
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) recognize(files, files.map((f) => f.name))
              e.target.value = ''
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={camOpen} onOpenChange={(v) => !v && closeCamera()}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>单据拍摄</DialogTitle>
          </DialogHeader>
          <video ref={videoRef} autoPlay playsInline muted className='w-full rounded-lg bg-black' />
          <div className='flex flex-wrap gap-2'>
            {shots.map((s, i) => (
              <img key={i} src={URL.createObjectURL(s)} alt={`照片${i + 1}`} className='h-16 rounded border' />
            ))}
          </div>
          <Separator />
          <div className='flex gap-2'>
            <Button type='button' onClick={snap}>
              <Camera /> 拍照
            </Button>
            <Button
              type='button'
              variant='default'
              disabled={!shots.length || ocrMut.isPending}
              onClick={async () => {
                await recognize(shots)
                closeCamera()
              }}
            >
              {ocrMut.isPending ? <Loader2 className='animate-spin' /> : null} 识别这几张
            </Button>
            <Button type='button' variant='outline' onClick={closeCamera}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
