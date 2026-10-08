import { createFileRoute } from '@tanstack/react-router'
import { PriceHistory } from '@/features/inbound/components/price-history'

export const Route = createFileRoute('/_authenticated/prices')({
  component: () => (
    <div className='space-y-4'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>价格历史</h2>
        <p className='text-muted-foreground text-sm'>
          同一物料不同批次的入库价都保留，可回溯每次成交；定价时带出最近一次价作参考。
        </p>
      </div>
      <PriceHistory />
    </div>
  ),
})
