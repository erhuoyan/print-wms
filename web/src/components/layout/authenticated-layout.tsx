import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SkipToMain } from '@/components/skip-to-main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Route } from '@/routes/_authenticated/route'

export function AuthenticatedLayout() {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { user } = Route.useRouteContext()

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar
            user={{ display_name: user.display_name, username: user.username, role: user.role }}
          />
          <SidebarInset
            className={cn(
              '@container/content',
              'has-data-[layout=fixed]:h-svh',
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            <Header fixed>
              <div className='ms-auto flex items-center gap-2'>
                <ThemeSwitch />
                <ProfileDropdown
                  user={{
                    name: user.display_name || user.username,
                    email: user.username,
                    roleLabel: user.role_label,
                  }}
                />
              </div>
            </Header>
            <Main>
              <Outlet />
            </Main>
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
