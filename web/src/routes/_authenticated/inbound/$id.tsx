import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useReceipt } from '@/features/inbound/api/hooks'
import { ReceiptDetailView } from '@/features/inbound/components/receipt-detail'

export const Route = createFileRoute('/_authenticated/inbound/$id')({
  component: ReceiptDetailPage,
})

function ReceiptDetailPage() {
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
  return <ReceiptDetailView receipt={data} />
}
