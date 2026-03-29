'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard, Clock, Settings, FileText,
  LogOut, Users, Zap, Menu, X, FileText as FileIcon,
  Calendar, Repeat
} from 'lucide-react'
import { useState } from 'react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface NavItem {
  label: string
  href: string
  icon: any
  adminOnly?: boolean
  memberOnly?: boolean
  children?: { label: string; href: string; icon: any }[]
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data, status } = useSession()
  const { isDemo, demoUser, exitDemoMode } = useDemoMode()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'
  const isMember = user?.role === 'MEMBER'

  const navigation: NavItem[] = [
    { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
    { 
      label: 'Présences', 
      href: '/attendance', 
      icon: Clock,
      children: isAdmin ? [
        { label: 'Historique', href: '/admin/attendance/history', icon: Clock },
        { label: 'Gestion', href: '/admin/attendance/management', icon: Settings },
        { label: 'Rapports', href: '/admin/attendance/reports', icon: FileText },
      ] : undefined
    },
    { 
      label: 'Planning', 
      href: '/planning', 
      icon: Calendar,
      children: isAdmin ? [
        { label: 'Gestion Planning', href: '/admin/planning/management', icon: Calendar },
        { label: 'Validation Swaps', href: '/admin/planning/swaps', icon: Repeat },
        { label: 'Rapports', href: '/admin/planning/reports', icon: FileText },
        { label: 'Points Ramassage', href: '/admin/planning/pickup', icon: Users },
      ] : undefined
    },
    { label: 'Projets VD', href: '/projects', icon: FileText },
    { label: 'Administration', href: '/admin', icon: Settings, adminOnly: true },
  ]

  const handleSignOut = () => {
    if (isDemo) {
      exitDemoMode()
      router.push('/')
    } else {
      signOut({ callbackUrl: '/' })
    }
  }

  const handleNavClick = (href: string, hasChildren?: boolean) => {
    if (hasChildren) {
      // ✅ Ne rien faire au click sur le parent - les sous-menus sont toujours visibles
      return
    } else {
      router.push(href)
      setSidebarOpen(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-800 border border-indigo-200 rounded-md shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-6 w-6 text-indigo-600" /> : <Menu className="h-6 w-6 text-indigo-600" />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-r border-indigo-100 dark:border-indigo-900 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FileIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VDM</span>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 flex-1 overflow-y-auto">
            {navigation.map((item) => {
              if (item.adminOnly && !isAdmin) return null
              
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              const hasChildren = item.children && item.children.length > 0
              const Icon = item.icon

              return (
                <div key={item.href}>
                  {/* Parent item */}
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 ${
                      isActive && !hasChildren
                        ? 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700'
                        : 'hover:bg-indigo-50'
                    }`}
                    onClick={() => handleNavClick(item.href, hasChildren)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {/* ✅ FLÈCHES SUPPRIMÉES - Les sous-menus sont toujours visibles */}
                  </Button>

                  {/* ✅ Sous-menu TOUJOURS AFFICHÉ (pas de toggle) */}
                  {hasChildren && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-indigo-200 pl-3">
                      {item.children?.map((child) => {
                        const childIcon = child.icon
                        const childActive = pathname === child.href
                        return (
                          <Button
                            key={child.href}
                            variant="ghost"
                            size="sm"
                            className={`w-full justify-start gap-2 text-xs h-8 ${
                              childActive 
                                ? 'text-indigo-700 bg-indigo-50 font-medium' 
                                : 'text-muted-foreground hover:text-indigo-600'
                            }`}
                            onClick={() => {
                              router.push(child.href)
                              setSidebarOpen(false)
                            }}
                          >
                            {childIcon && (() => { const Icon = childIcon; return <Icon className="w-3 h-3" /> })()}
                            {child.label}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-indigo-100 pt-4 mt-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {isDemo && (
                  <Badge className="mt-1 bg-indigo-500 text-white text-xs border-0">
                    <Zap className="w-3 h-3 mr-1" />Démo
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 border-indigo-200 hover:bg-indigo-50"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}