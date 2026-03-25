'use client'

import { useEffect, useState } from 'react'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Database,
  Zap,
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
  assignedTo: { name: string }
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
  const { isDemo, demoUser, exitDemoMode } = useDemoMode()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'MEMBER' })

  const user: DemoUser | null = session?.user as DemoUser || demoUser

  useEffect(() => {
    if (!isDemo) {
      if (status === 'unauthenticated') {
        router.push('/login')
      } else if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') {
        router.push('/dashboard')
      }
    }
  }, [status, session, router, isDemo])

  useEffect(() => {
    if (user) {
      fetchAdminData()
    }
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
    } catch (error) {
      console.error('Error fetching admin data:', error)
      toast.error('Échec du chargement des données d\'administration')
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
        throw new Error(error.error || 'Échec de la création de l\'utilisateur')
      }

      toast.success('Utilisateur créé avec succès')
      setShowUserDialog(false)
      setNewUser({ name: '', email: '', password: '', role: 'MEMBER' })
      fetchAdminData()
    } catch (error: any) {
      toast.error(error.message || 'Échec de la création de l\'utilisateur')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Échec de la suppression de l\'utilisateur')

      toast.success('Utilisateur supprimé avec succès')
      fetchAdminData()
    } catch (error) {
      toast.error('Échec de la suppression de l\'utilisateur')
    }
  }

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
       
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
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
              <ArrowLeft className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Administration VDM</h1>
        
          </div>
          <Button onClick={() => router.push('/characters')} className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
            <Database className="h-4 w-4" />
            Base de données
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Statistics */}
        <section>
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Vue d'ensemble</h2>
        
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Card className="border-2 border-indigo-200 hover:border-indigo-400 dark:border-indigo-800 dark:hover:border-indigo-600 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Total Projets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{stats.totalProjects}</div>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-200 hover:border-emerald-400 dark:border-emerald-800 dark:hover:border-emerald-600 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Terminés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500">
                  {stats.completedProjects}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 hover:border-amber-400 dark:border-amber-800 dark:hover:border-amber-600 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  En cours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">
                  {stats.inProgressProjects}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-200 hover:border-red-400 dark:border-red-800 dark:hover:border-red-600 transition-all hover:shadow-lg hover:shadow-red-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  En retard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 dark:text-red-500">
                  {stats.lateProjects}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 hover:border-purple-400 dark:border-purple-800 dark:hover:border-purple-600 transition-all hover:shadow-lg hover:shadow-purple-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Total Utilisateurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{stats.totalUsers}</div>
              </CardContent>
            </Card>

            <Card className="border-2 border-pink-200 hover:border-pink-400 dark:border-pink-800 dark:hover:border-pink-600 transition-all hover:shadow-lg hover:shadow-pink-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Séries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">{stats.totalSeries}</div>
              </CardContent>
            </Card>

            <Card className="border-2 border-indigo-200 hover:border-indigo-400 dark:border-indigo-800 dark:hover:border-indigo-600 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Personnages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{stats.totalCharacters}</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Management Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
            <TabsTrigger value="users" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Utilisateurs</TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Projets récents</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Gestion des utilisateurs</h2>
              <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                    <Plus className="h-4 w-4" />
                    Ajouter un utilisateur
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-xl">Créer un nouvel utilisateur</DialogTitle>
                    <DialogDescription>
                      Ajouter un nouveau membre de l'équipe à la plateforme.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nom</Label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          required
                          className="border-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          required
                          className="border-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          required
                          className="border-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Rôle</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                        >
                          <SelectTrigger className="border-indigo-200 focus:border-indigo-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Membre d'équipe</SelectItem>
                            <SelectItem value="ADMIN">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)} className="border-slate-300">
                        Annuler
                      </Button>
                      <Button type="submit" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
                        Créer l'utilisateur
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {users.map((user) => (
                <Card key={user.id} className="border-2 border-indigo-100 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{user.name}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge 
                          variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                          className={
                            user.role === 'ADMIN' 
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0' 
                              : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0'
                          }
                        >
                          {user.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {user._count.projects} projets
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                          className="hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Projets récents</h2>
            <div className="grid gap-4">
              {stats.recentProjects.map((project) => (
                <Card key={project.id} className="border-2 border-indigo-100 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {project.seriesName} - {project.season}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          className={
                            project.status === 'DONE' 
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0'
                              : project.status === 'IN_PROGRESS'
                              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0'
                              : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0'
                          }
                        >
                          {project.status === 'DONE' 
                            ? 'Terminé' 
                            : project.status === 'IN_PROGRESS' 
                            ? 'En cours' 
                            : 'Non commencé'}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Assigné à {project.assignedTo.name}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
<AdminAttendanceView />
        
      </main>
    </div>
  )
}
