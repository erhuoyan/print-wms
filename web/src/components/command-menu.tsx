import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/stores/auth-store'
import { buildSidebarData } from './layout/data/sidebar-data'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const user = useAuthStore((s) => s.user)

  const sidebarData = React.useMemo(
    () =>
      buildSidebarData({
        display_name: user?.display_name ?? '',
        username: user?.username ?? '',
        role: user?.role ?? 'clerk',
      }),
    [user]
  )

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='输入命令或搜索…' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>没有匹配项</CommandEmpty>
          {sidebarData.navGroups.map((group) => {
            const items = group.items.filter((it) => !it.roles || it.roles.includes(user?.role ?? 'clerk'))
            if (!items.length) return null
            return (
              <CommandGroup key={group.title} heading={group.title}>
                {items.map((navItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${i}`}
                    value={navItem.title}
                    onSelect={() => runCommand(() => navigate({ to: navItem.url }))}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='text-muted-foreground/80 size-2' />
                    </div>
                    {navItem.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
          <CommandSeparator />
          <CommandGroup heading='主题'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>浅色</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon /> <span>深色</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop /> <span>跟随系统</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
