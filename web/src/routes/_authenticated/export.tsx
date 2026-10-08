import { createFileRoute } from '@tanstack/react-router'
import { ExportPanel } from '@/features/inbound/components/export-panel'

export const Route = createFileRoute('/_authenticated/export')({
  component: () => (
    <div className='space-y-4'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>导出 Excel</h2>
        <p className='text-muted-foreground text-sm'>按模板导出明细，供录入现有系统或交给财务。</p>
      </div>
      <ExportPanel />
    </div>
  ),
})
