import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useReceipt } from '@/features/inbound/api/hooks'
import { ReceiptForm } from '@/features/inbound/components/receipt-form'

export const Route = createFileRoute('/_authenticated/inbound/$id_/edit')({
  component: EditReceiptPage,
})

function EditReceiptPage() {
  const { id } = Route.useParams()
  const { data, isLoading } = useReceipt(Number(id))
  if (isLoading) {
    return (
      <div className='text-muted-foreground flex h-64 items-center justify-center gap-2'>
        <Loader2 className='animate-spin' /> 加载中…
      </div>
    )
  }
  if (!data) return <div className='text-muted-foreground'>单据不存在</div>
  return (
    <div className='space-y-4'>
      <h2 className='text-2xl font-bold tracking-tight'>编辑入库单 #{data.id}</h2>
      <ReceiptForm receipt={data} />
    </div>
  )
}
