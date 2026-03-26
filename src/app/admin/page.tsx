'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Users, FileText, TrendingUp, AlertCircle, Plus, Trash2, ArrowLeft, Database, Clock,
} from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'
import AdminAttendanceView from '@/components/AdminAttendanceView'

interface User {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  _count: { projects: number }
}

interface Project {
  id: string
  name: string
  seriesName: string
  season: string
  status: string
  deadline: string
}

interface Stats {
  totalProjects: number
  completedProjects: number
  inProgressProjects: number
  notStartedProjects: number
  lateProjects: number
  totalUsers: number
  totalSeries: number
  totalCharacters: number
  recentProjects: Project[]
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'MEMBER' })

  const user: DemoUser | null = session?.user as DemoUser || demoUser

  useEffect(() => {
    if (!isDemo) {
      if (status === 'unauthenticated') router.push('/login')
      else if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') router.push('/dashboard')
    }
  }, [status, session, router, isDemo])

  useEffect(() => {
    if (user) fetchAdminData()
  }, [user])

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/users'),
      ])
      if (statsRes.ok && usersRes.ok) {
        const [statsData, usersData] = await Promise.all([statsRes.json(), usersRes.json()])
        setStats(statsData)
        setUsers(usersData)
      }
    } catch {
      toast.error('Échec du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Échec')
      }
      toast.success('Utilisateur créé')
      setShowUserDialog(false)
      setNewUser({ name: '', email: '', password: '', role: 'MEMBER' })
      fetchAdminData()
    } catch (error: any) {
      toast.error(error.message || 'Échec de la création')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Utilisateur supprimé')
      fetchAdminData()
    } catch {
      toast.error('Échec de la suppression')
    }
  }

  const getProjectStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      FAIT: 'bg-emerald-500', EN_COURS: 'bg-amber-500',
      PAS_ENCORE: 'bg-slate-400', ANNULE: 'bg-red-400',
    }
    const labels: Record<string, string> = {
      FAIT: 'Fait', EN_COURS: 'En cours', PAS_ENCORE: 'Pas encore', ANNULE: 'Annulé',
    }
    return <Badge className={`${map[s] || 'bg-slate-400'} text-white border-0`}>{labels[s] || s}</Badge>
  }

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="hover:bg-indigo-50">
              <ArrowLeft className="h-5 w-5 text-indigo-600" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Administration VDM
            </h1>
          </div>
          <Button onClick={() => router.push('/characters')} className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <Database className="h-4 w-4" />Base de données
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">

        {/* Stats */}
        <section>
          <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Vue d'ensemble</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Projets', value: stats.totalProjects, color: 'indigo', icon: <FileText className="h-4 w-4 text-indigo-600" /> },
              { label: 'Terminés', value: stats.completedProjects, color: 'emerald', icon: <TrendingUp className="h-4 w-4 text-emerald-600" /> },
              { label: 'En cours', value: stats.inProgressProjects, color: 'amber', icon: <TrendingUp className="h-4 w-4 text-amber-600" /> },
              { label: 'En retard', value: stats.lateProjects, color: 'red', icon: <AlertCircle className="h-4 w-4 text-red-600" /> },
              { label: 'Utilisateurs', value: stats.totalUsers, color: 'purple', icon: <Users className="h-4 w-4 text-purple-600" /> },
              { label: 'Séries', value: stats.totalSeries, color: 'pink', icon: <FileText className="h-4 w-4 text-pink-600" /> },
              { label: 'Personnages', value: stats.totalCharacters, color: 'indigo', icon: <Database className="h-4 w-4 text-indigo-600" /> },
            ].map(s => (
              <Card key={s.label} className={`border-2 border-${s.color}-200 hover:border-${s.color}-400 transition-all hover:shadow-lg`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {s.icon}{s.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold text-${s.color}-600`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Main tabs */}
        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
            <TabsTrigger value="attendance" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <Clock className="h-4 w-4" />Présences
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              Projets récents
            </TabsTrigger>
          </TabsList>

          {/* Attendance tab */}
          <TabsContent value="attendance">
            <AdminAttendanceView />
          </TabsContent>

          {/* Users tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Gestion des utilisateurs</h2>
              <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <Plus className="h-4 w-4" />Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un utilisateur</DialogTitle>
                    <DialogDescription>Ajouter un nouveau membre à la plateforme.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Mot de passe</Label>
                        <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Rôle</Label>
                        <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Membre</SelectItem>
                            <SelectItem value="ADMIN">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>Annuler</Button>
                      <Button type="submit" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">Créer</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-4">
              {users.map(u => (
                <Card key={u.id} className="border-2 border-indigo-100 hover:border-indigo-300 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">{u.name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={u.role === 'ADMIN' ? 'bg-indigo-500 text-white border-0' : 'bg-slate-400 text-white border-0'}>
                          {u.role === 'ADMIN' ? 'Admin' : 'Membre'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{u._count.projects} projets</span>
                        <Button variant="ghost" size="icon" className="hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteUser(u.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Projects tab */}
          <TabsContent value="projects" className="space-y-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Projets récents</h2>
            <div className="grid gap-4">
              {stats.recentProjects.map(p => (
                <Card key={p.id} className="border-2 border-indigo-100 hover:border-indigo-300 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.seriesName} {p.season && `· S${p.season}`}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getProjectStatusBadge(p.status)}
                        <span className="text-sm text-muted-foreground">
                          {new Date(p.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
