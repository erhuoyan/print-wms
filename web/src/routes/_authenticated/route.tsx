import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { api, type User } from '@/lib/api'

/**
 * 认证守卫 + 后台布局：进入受保护路由前先确认会话有效，
 * 用户信息通过 route context 传给布局（侧栏按角色过滤菜单）。
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    try {
      const user = await api.get<User>('/auth/me')
      return { user }
    } catch {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})
