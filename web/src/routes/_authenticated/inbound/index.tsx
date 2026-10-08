import { createFileRoute } from '@tanstack/react-router'
import { ReceiptsList } from '@/features/inbound/components/receipts-list'

export const Route = createFileRoute('/_authenticated/inbound/')({
  component: () => (
    <div className='space-y-4'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>入库单据</h2>
        <p className='text-muted-foreground text-sm'>
          录单 → 领导定价 → 已定价 → 导出。点击单号查看明细。
        </p>
      </div>
      <ReceiptsList />
    </div>
  ),
})
