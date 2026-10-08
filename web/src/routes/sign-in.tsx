import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  username: z.string().min(1, '请输入账号'),
  password: z.string().min(1, '请输入密码'),
})
type FormValues = z.infer<typeof schema>

export const Route = createFileRoute('/sign-in')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: SignIn,
})

function SignIn() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { redirect } = Route.useSearch()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      const user = await login(values.username, values.password)
      toast.success(`欢迎，${user.display_name}（${user.role_label}）`)
      navigate({ to: redirect || '/inbound', replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader className='space-y-3'>
          <div className='flex items-center gap-2'>
            <span className='flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
              <Package className='size-5' />
            </span>
            <div>
              <CardTitle className='text-lg'>仓库管理</CardTitle>
              <CardDescription>印刷厂入库单系统</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className='space-y-4' onSubmit={form.handleSubmit(onSubmit)}>
            <div className='space-y-2'>
              <Label htmlFor='username'>账号</Label>
              <Input id='username' autoComplete='username' autoFocus {...form.register('username')} />
              {form.formState.errors.username && (
                <p className='text-xs text-destructive'>{form.formState.errors.username.message}</p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>密码</Label>
              <Input id='password' type='password' autoComplete='current-password' {...form.register('password')} />
              {form.formState.errors.password && (
                <p className='text-xs text-destructive'>{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button className='w-full' type='submit' disabled={submitting}>
              {submitting && <Loader2 className='animate-spin' />}
              登录
            </Button>
          </form>
          <p className='mt-4 text-xs text-muted-foreground'>
            初始管理员账号 <span className='font-mono'>admin</span> / <span className='font-mono'>admin123</span>，
            登录后请立即修改密码。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
