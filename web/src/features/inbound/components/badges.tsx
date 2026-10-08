import { cn } from '@/lib/utils'

const MAP: Record<string, { label: string; className: string }> = {
  pending_pricing: {
    label: '待定价',
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  },
  priced: {
    label: '已定价',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  },
  void: {
    label: '已作废',
    className: 'bg-muted text-muted-foreground ring-border',
  },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const item = MAP[status] ?? { label: status, className: 'bg-muted text-muted-foreground ring-border' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        item.className,
        className
      )}
    >
      {item.label}
    </span>
  )
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        source === 'ocr'
          ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20'
          : 'bg-muted text-muted-foreground ring-border'
      )}
    >
      {source === 'ocr' ? '拍照识别' : '手工录入'}
    </span>
  )
}
