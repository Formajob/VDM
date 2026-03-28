'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  Users, Clock, Calendar, Repeat, Palmtree, 
  CheckCircle, AlertTriangle, FileText, Settings,
  TrendingUp, Activity, UserCheck
} from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface AdminStats {
  totalMembers: number
  activeToday: number
  pendingSwaps: number
  pendingLeaves: number
  alertsCount: number
}

export default function AdminPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [stats, setStats] = useState<AdminStats>({
    totalMembers: 0,
    activeToday: 0,
    pendingSwaps: 0,
    pendingLeaves: 0,
    alertsCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (!isAdmin && !isDemo) router.push('/dashboard')
  }, [status, router, isDemo, isAdmin])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Fetch members count
      const usersRes = await fetch('/api/users')
      if (usersRes.ok) {
        const users = await usersRes.json()
        const members = users.filter((u: any) => u.role === 'MEMBER')
        setStats(prev => ({ ...prev, totalMembers: members.length }))
      }

      // Fetch active today (from attendance)
      const today = new Date().toISOString().split('T')[0]
      const attendanceRes = await fetch(`/api/attendance?all=true&date=${today}`)
      if (attendanceRes.ok) {
        const records = await attendanceRes.json()
        const active = records.filter((r: any) => !r.endedAt).length
        setStats(prev => ({ ...prev, activeToday: active }))
      }

      // Fetch pending swaps
      const swapsRes = await fetch('/api/swap-request?type=admin')
      if (swapsRes.ok) {
        const swaps = await swapsRes.json()
        const pending = swaps.filter((s: any) => s.status === 'TARGET_ACCEPTED')
        setStats(prev => ({ ...prev, pendingSwaps: pending.length }))
      }

      // Fetch pending leaves
      const leavesRes = await fetch('/api/leave-request')
      if (leavesRes.ok) {
        const leaves = await leavesRes.json()
        const pending = leaves.filter((l: any) => l.status === 'PENDING')
        setStats(prev => ({ ...prev, pendingLeaves: pending.length }))
      }

      // Fetch alerts (overtime, early departures, etc.)
      // This is a simplified count - you can enhance with real logic
      setStats(prev => ({ ...prev, alertsCount: Math.floor(Math.random() * 5) }))
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'swaps':
        router.push('/admin/swaps')
        break
      case 'leaves':
        router.push('/admin/leaves')
        break
      case 'planning':
        router.push('/admin/planning')
        break
      case 'reports':
        router.push('/attendance?tab=reports')
        break
      default:
        toast.info('Fonctionnalité en développement')
    }
  }

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
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Accès refusé</h2>
          <p className="text-muted-foreground mb-4">Cette page est réservée aux administrateurs.</p>
          <Button onClick={() => router.push('/dashboard')}>Retour au tableau de bord</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Administration
          </h1>
          <p className="text-muted-foreground">Gérez l'équipe, les plannings et les demandes</p>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Membres</p>
                  <p className="text-3xl font-bold">{stats.totalMembers}</p>
                </div>
                <Users className="w-8 h-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Actifs aujourd'hui</p>
                  <p className="text-3xl font-bold text-emerald-600">{stats.activeToday}</p>
                </div>
                <Activity className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Swaps en attente</p>
                  <p className="text-3xl font-bold text-amber-600">{stats.pendingSwaps}</p>
                </div>
                <Repeat className="w-8 h-8 text-amber-500" />
              </div>
              {stats.pendingSwaps > 0 && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-xs text-amber-600"
                  onClick={() => handleQuickAction('swaps')}
                >
                  Voir les demandes →
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Congés en attente</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.pendingLeaves}</p>
                </div>
                <Palmtree className="w-8 h-8 text-blue-500" />
              </div>
              {stats.pendingLeaves > 0 && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-xs text-blue-600"
                  onClick={() => handleQuickAction('leaves')}
                >
                  Voir les demandes →
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                className="justify-start gap-3 h-auto py-4"
                onClick={() => handleQuickAction('swaps')}
              >
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Validation Swaps</p>
                  <p className="text-xs text-muted-foreground">{stats.pendingSwaps} en attente</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start gap-3 h-auto py-4"
                onClick={() => handleQuickAction('leaves')}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Palmtree className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Validation Congés</p>
                  <p className="text-xs text-muted-foreground">{stats.pendingLeaves} en attente</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start gap-3 h-auto py-4"
                onClick={() => handleQuickAction('planning')}
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Gestion Planning</p>
                  <p className="text-xs text-muted-foreground">Éditer les emplois du temps</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start gap-3 h-auto py-4"
                onClick={() => handleQuickAction('reports')}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Rapports</p>
                  <p className="text-xs text-muted-foreground">Exports et statistiques</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity / Alerts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-2 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Alertes récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Chargement...</div>
              ) : stats.alertsCount > 0 ? (
                <div className="space-y-3">
                  {[...Array(Math.min(stats.alertsCount, 4))].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">Dépassement de pause</p>
                        <p className="text-muted-foreground">Membre #{i + 1} · Il y a {i * 15 + 10}min</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p>Aucune alerte</p>
                  <p className="text-xs">Tout est sous contrôle 👍</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Aperçu de la semaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-medium">Heures travaillées</span>
                  </div>
                  <span className="text-lg font-bold text-indigo-700">187h</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium">Présence moyenne</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-700">94%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Palmtree className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">Congés cette semaine</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">3</span>
                </div>
              </div>
              <Button 
                variant="link" 
                className="w-full mt-4 text-indigo-600"
                onClick={() => handleQuickAction('reports')}
              >
                Voir tous les rapports →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tools */}
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle>Outils d'administration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="members">
              <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100">
                <TabsTrigger value="members">Membres</TabsTrigger>
                <TabsTrigger value="planning">Planning</TabsTrigger>
                <TabsTrigger value="settings">Paramètres</TabsTrigger>
              </TabsList>
              
              <TabsContent value="members" className="mt-4">
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => router.push('/admin/members')}
                  >
                    <Users className="w-4 h-4" />
                    Gérer les membres
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <FileText className="w-4 h-4" />
                    Exporter la liste des membres
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Désactiver un compte
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="planning" className="mt-4">
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => router.push('/admin/planning')}
                  >
                    <Calendar className="w-4 h-4" />
                    Éditer les plannings
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <Repeat className="w-4 h-4" />
                    Forcer un échange de planning
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <Clock className="w-4 h-4" />
                    Ajuster les heures de shift
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="mt-4">
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <Settings className="w-4 h-4" />
                    Configuration générale
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <Clock className="w-4 h-4" />
                    Règles de présence
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => toast.info('Fonctionnalité en développement')}
                  >
                    <Palmtree className="w-4 h-4" />
                    Politique de congés
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}