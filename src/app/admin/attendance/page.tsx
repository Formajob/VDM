'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Clock, Settings, FileText, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

export default function AdminAttendancePage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (!isAdmin && !isDemo) router.push('/dashboard')
  }, [status, router, isDemo, isAdmin])

  const modules = [
    {
      title: 'Historique',
      description: 'Consulter l\'historique complet des pointages de l\'équipe',
      icon: Clock,
      href: '/admin/attendance/history',
      color: 'indigo'
    },
    {
      title: 'Gestion',
      description: 'Valider, corriger et gérer les écarts de pointage',
      icon: Settings,
      href: '/admin/attendance/management',
      color: 'amber'
    },
    {
      title: 'Rapports',
      description: 'Générer les rapports de performance (écarts, adhérence, assiduité)',
      icon: FileText,
      href: '/admin/attendance/reports',
      color: 'emerald'
    }
  ]

  if (status === 'loading' && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isAdmin && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <p className="text-muted-foreground">Accès réservé aux administrateurs</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>Retour</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Présences - Administration
          </h1>
          <p className="text-muted-foreground">Gérez les pointages, écarts et rapports de performance</p>
        </div>

        {/* Quick Stats */}
        <div className="grid sm:grid-cols-4 gap-4">
          <Card className="border-2 border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Présents aujourd'hui</p>
                  <p className="text-2xl font-bold text-emerald-600">—</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Retards</p>
                  <p className="text-2xl font-bold text-amber-600">—</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Décharges</p>
                  <p className="text-2xl font-bold text-red-600">—</p>
                </div>
                <Clock className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Adhérence moy.</p>
                  <p className="text-2xl font-bold text-indigo-600">—%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules */}
        <div className="grid md:grid-cols-3 gap-4">
          {modules.map((module) => {
            const Icon = module.icon
            const colorClasses: Record<string, string> = {
              indigo: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50',
              amber: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50',
              emerald: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
            }
            const iconColors: Record<string, string> = {
              indigo: 'text-indigo-600 bg-indigo-100',
              amber: 'text-amber-600 bg-amber-100',
              emerald: 'text-emerald-600 bg-emerald-100',
            }
            
            return (
              <Card 
                key={module.href}
                className={`border-2 cursor-pointer transition-all ${colorClasses[module.color]}`}
                onClick={() => router.push(module.href)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[module.color]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {module.title}
                    </CardTitle>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Info */}
        <Card className="border-2 border-slate-200 bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-slate-600 mt-0.5" />
              <div className="text-sm text-slate-700">
                <p className="font-medium">💡 Indicateurs de performance :</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600">
                  <li><strong>Écarts</strong> : Différence entre planning et pointage réel</li>
                  <li><strong>Adhérence</strong> : % de respect des horaires planifiés</li>
                  <li><strong>Assiduité</strong> : Taux de présence sur la période</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}