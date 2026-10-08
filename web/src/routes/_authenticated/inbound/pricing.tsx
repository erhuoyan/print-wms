import { createFileRoute } from '@tanstack/react-router'
import { PricingBoard } from '@/features/inbound/components/pricing-board'

export const Route = createFileRoute('/_authenticated/inbound/pricing')({
  component: () => (
    <div className='space-y-4'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>待定价</h2>
        <p className='text-muted-foreground text-sm'>
          给待定价单据填单价。同物料会带出最近一次成交价作参考。
        </p>
      </div>
      <PricingBoard />
    </div>
  ),
})
