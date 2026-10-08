import { createFileRoute } from '@tanstack/react-router'
import { ReceiptForm } from '@/features/inbound/components/receipt-form'

export const Route = createFileRoute('/_authenticated/inbound/new')({
  component: () => (
    <div className='space-y-4'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>录入入库单</h2>
        <p className='text-muted-foreground text-sm'>
          拍照识别或手工填写；保存后进入「待定价」，等领导填单价。
        </p>
      </div>
      <ReceiptForm />
    </div>
  ),
})
