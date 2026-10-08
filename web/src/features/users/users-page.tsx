import { useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUsers } from '@/features/inbound/api/hooks'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'

const ROLES = [
  { value: 'clerk', label: '录入员', desc: '录单、查看、导出' },
  { value: 'leader', label: '领导', desc: '录入员权限 + 定价/改价/作废、维护价格' },
  { value: 'admin', label: '管理员', desc: '全部权限 + 用户管理' },
]

export function UsersPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const { data, isLoading } = useUsers()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'clerk' })
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<{ id: number; username: string } | null>(null)

  const rows = data?.rows ?? []

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const create = async () => {
    setSaving(true)
    try {
      await api.post('/auth/users', form)
      toast.success('账号已创建')
      setOpen(false)
      setForm({ username: '', display_name: '', password: '', role: 'clerk' })
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const patch = async (id: number, payload: Record<string, unknown>) => {
    try {
      await api.put(`/auth/users/${id}`, payload)
      toast.success('已更新')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const remove = async (id: number) => {
    try {
      await api.del(`/auth/users/${id}`)
      toast.success('已删除')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>用户管理</h2>
          <p className='text-muted-foreground text-sm'>
            权限由服务端强制校验；这里是唯一能创建账号 / 分配角色 / 停用账号的地方。
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus /> 新建账号
        </Button>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        {ROLES.map((r) => (
          <Card key={r.value}>
            <CardContent className='py-4'>
              <div className='font-medium'>{r.label}</div>
              <div className='text-muted-foreground mt-1 text-xs'>{r.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>账号列表</CardTitle>
        </CardHeader>
        <CardContent className='px-0'>
          {isLoading ? (
            <div className='text-muted-foreground flex h-24 items-center justify-center gap-2'>
              <Loader2 className='animate-spin' /> 加载中…
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>账号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className='text-right'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className='font-mono text-sm'>{u.username}</TableCell>
                      <TableCell className='font-medium'>{u.display_name || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(v) => patch(u.id, { role: v })}
                          disabled={u.id === me?.id}
                        >
                          <SelectTrigger className='h-8 w-28'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.active ? (
                          <Badge variant='secondary'>启用</Badge>
                        ) : (
                          <Badge variant='outline' className='text-muted-foreground'>
                            已停用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-sm'>{u.created_at}</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={u.id === me?.id}
                            onClick={() => {
                              const pwd = prompt(`为「${u.username}」设置新密码（至少 6 位）`)
                              if (pwd) patch(u.id, { password: pwd })
                            }}
                          >
                            <Save className='size-3.5' /> 重置密码
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={u.id === me?.id}
                            onClick={() => patch(u.id, { active: !u.active })}
                          >
                            {u.active ? '停用' : '启用'}
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            className='text-destructive'
                            disabled={u.id === me?.id}
                            onClick={() => setDelTarget({ id: u.id, username: u.username })}
                          >
                            <Trash2 className='size-3.5' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>新建账号</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>账号 *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>姓名</Label>
              <Input
                placeholder='用于单据上的「录入人 / 定价人」'
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>初始密码 *（至少 6 位）</Label>
              <Input
                type='text'
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>角色</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label} — {r.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className='animate-spin' />}创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(v) => !v && setDelTarget(null)}
        title={`删除账号「${delTarget?.username}」？`}
        desc='删除后该账号立即无法登录。已录入的单据会保留。'
        confirmText='删除'
        destructive
        handleConfirm={() => {
          if (delTarget) remove(delTarget.id)
          setDelTarget(null)
        }}
      />
    </div>
  )
}
