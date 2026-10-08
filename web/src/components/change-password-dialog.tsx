import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (newPwd.length < 6) {
      toast.error('新密码至少 6 位')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/password', { old_password: oldPwd, new_password: newPwd })
      toast.success('密码已修改')
      setOldPwd('')
      setNewPwd('')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '修改失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>修改后其他设备上的登录会失效。</DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='old-pwd'>原密码</Label>
            <Input id='old-pwd' type='password' value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-pwd'>新密码（至少 6 位）</Label>
            <Input id='new-pwd' type='password' value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className='animate-spin' />}保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
