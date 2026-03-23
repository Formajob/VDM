'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Circle, 
  AlertCircle,
  LogOut,
  LayoutDashboard,
  Users,
  Database,
  Settings,
  Bell,
  Menu,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface Project {
  id: string
  name: string
  seriesName: string
  season: string
  pageCount: number
  writingDate: string | null
  deadline: string
  status: 'DONE' | 'IN_PROGRESS' | 'NOT_STARTED'
  progress: number
  assignedTo: {
    id: string
    name: string
    email: string
  }
}

type StatusFilter = 'ALL' | 'DONE' | 'IN_PROGRESS' | 'NOT_STARTED'
type SortOption = 'deadline' | 'name' | 'status'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const { isDemo, demoUser, exitDemoMode } = useDemoMode()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortOption>('deadline')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Get user from either session or demo mode
  const user: DemoUser | null = session?.user as DemoUser || demoUser
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router, isDemo])

  useEffect(() => {
    if (user) {
      fetchProjects()
    }
  }, [user, statusFilter, sortBy])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      params.append('sortBy', sortBy)

      const res = await fetch(`/api/projects?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data)
    } catch (error) {
      console.error('Error fetching projects:', error)
      toast.error('Échec du chargement des projets')
    } finally {
      setLoading(false)
    }
  }

  const updateProjectStatus = async (projectId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error('Failed to update project')

      toast.success('Projet mis à jour avec succès')
      fetchProjects()
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Échec de la mise à jour du projet')
    }
  }

  const handleSignOut = () => {
    if (isDemo) {
      exitDemoMode()
      router.push('/')
    } else {
      signOut({ callbackUrl: '/' })
    }
  }

  const getDeadlineStatus = (deadline: string) => {
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilDeadline < 0) return 'late'
    if (hoursUntilDeadline < 48) return 'urgent'
    return 'normal'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE':
        return (
          <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Terminé
          </Badge>
        )
      case 'IN_PROGRESS':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0">
            <Clock className="w-3 h-3 mr-1" />
            En cours
          </Badge>
        )
      case 'NOT_STARTED':
        return (
          <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0">
            <Circle className="w-3 h-3 mr-1" />
            Non commencé
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getDeadlineBadge = (deadline: string) => {
    const status = getDeadlineStatus(deadline)

    if (status === 'late') {
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0">
          <AlertCircle className="w-3 h-3 mr-1" />
          En retard
        </Badge>
      )
    }

    if (status === 'urgent') {
      return (
        <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0">
          <AlertCircle className="w-3 h-3 mr-1" />
          Bientôt
        </Badge>
      )
    }

    return null
  }

  const filteredAndSortedProjects = projects

  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === 'DONE').length,
    inProgress: projects.filter((p) => p.status === 'IN_PROGRESS').length,
    notStarted: projects.filter((p) => p.status === 'NOT_STARTED').length,
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

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-md shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-6 w-6 text-indigo-600" /> : <Menu className="h-6 w-6 text-indigo-600" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-r border-indigo-100 dark:border-indigo-900 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VDM</span>
          </div>

          <nav className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300"
            >
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord
            </Button>

            {isAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => router.push('/admin')}
              >
                <Settings className="h-4 w-4" />
                Administration
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              onClick={() => router.push('/characters')}
            >
              <Database className="h-4 w-4" />
              Base de données
            </Button>
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-indigo-100 dark:border-indigo-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
                {isDemo && (
                  <Badge className="mt-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs border-0">
                    <Zap className="w-3 h-3 mr-1" />
                    Mode Démo
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Tableau de bord
              </h1>
              <p className="text-muted-foreground">
                Bon retour, {user?.name}
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => router.push('/admin')} className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                <Settings className="h-4 w-4" />
                Administration
              </Button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-2 border-indigo-200 hover:border-indigo-400 dark:border-indigo-800 dark:hover:border-indigo-600 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Total Projets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{stats.total}</div>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-200 hover:border-emerald-400 dark:border-emerald-800 dark:hover:border-emerald-600 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Terminés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 hover:border-amber-400 dark:border-amber-800 dark:hover:border-amber-600 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  En cours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">
                  {stats.inProgress}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500 transition-all hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Circle className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  Non commencés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">
                  {stats.notStarted}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[200px] border-indigo-200 focus:border-indigo-500 dark:border-indigo-800">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="DONE">Terminés</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="NOT_STARTED">Non commencés</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[200px] border-indigo-200 focus:border-indigo-500 dark:border-indigo-800">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline">Date limite</SelectItem>
                <SelectItem value="name">Nom</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Projects Grid */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project) => (
              <Card
                key={project.id}
                className="flex flex-col border-2 border-indigo-100 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-700 transition-all hover:shadow-xl hover:shadow-indigo-500/10"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1 text-slate-900 dark:text-white">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {project.seriesName} - {project.season}
                      </CardDescription>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Pages</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{project.pageCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date limite</p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {new Date(project.deadline).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  {getDeadlineBadge(project.deadline)}
                </CardContent>

                <CardFooter className="flex gap-2 pt-4">
                  {project.status !== 'DONE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                      onClick={() => updateProjectStatus(project.id, 'DONE')}
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Marquer terminé
                    </Button>
                  )}
                  {project.status !== 'IN_PROGRESS' && project.status !== 'DONE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 border-amber-300 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                      onClick={() => updateProjectStatus(project.id, 'IN_PROGRESS')}
                    >
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Commencer
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredAndSortedProjects.length === 0 && (
            <Card className="p-12 border-2 border-dashed border-indigo-200 dark:border-indigo-800">
              <div className="text-center space-y-4">
                <FileText className="h-12 w-12 text-indigo-300 dark:text-indigo-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium">Aucun projet trouvé</h3>
                  <p className="text-muted-foreground">
                    {statusFilter !== 'ALL'
                      ? 'Essayez de changer le filtre'
                      : 'Vous n\'avez pas encore de projet assigné'}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
