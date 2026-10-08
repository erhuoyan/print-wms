import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const logout = useAuthStore((s) => s.logout)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='退出登录'
      desc='确定要退出当前账号吗？'
      confirmText='退出'
      destructive
      handleConfirm={() => logout()}
      className='sm:max-w-sm'
    />
  )
}
