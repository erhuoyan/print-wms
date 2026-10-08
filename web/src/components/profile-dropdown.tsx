import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { ChangePasswordDialog } from '@/components/change-password-dialog'

type ProfileDropdownProps = {
  user: { name: string; email: string; roleLabel: string }
}

export function ProfileDropdown({ user }: ProfileDropdownProps) {
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [pwdOpen, setPwdOpen] = useDialogState()
  const initial = (user.name || '?').slice(0, 1).toUpperCase()

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarFallback className='bg-primary/10 text-primary'>{initial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end'>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm font-medium'>{user.name}</p>
              <p className='text-xs text-muted-foreground'>
                {user.email} · {user.roleLabel}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPwdOpen(true)}>修改密码</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setSignOutOpen(true)}>
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
      <ChangePasswordDialog open={!!pwdOpen} onOpenChange={setPwdOpen} />
    </>
  )
}
