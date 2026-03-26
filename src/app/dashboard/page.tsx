'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import AdminAttendanceView from '@/components/AdminAttendanceView'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Clock, CheckCircle2, Circle, AlertCircle,
  Zap, Users, TrendingUp, Briefcase
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'
import AttendanceSection from '@/components/AttendanceSection'

interface Project {
  id: string
  name: string
  seriesName: string
  season: string | null
  episodeNumber: string | null
  status: 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'ANNULE'
  workflowStep: 'REDACTION' | 'NARRATION' | 'MIXAGE' | 'LIVRAISON' | 'TERMINE'
  pageCount: number | null
  deadline: string
  redacteurId: string | null
  techSonId: string | null
  narratorId: string | null
  clientName: string | null
  broadcastChannel: string | null
}

type StatusFilter = 'ALL' | 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'ANNULE'
type SortOption = 'deadline' | 'name' | 'status'
type DepartmentFilter = 'TOUS' | 'REDACTION' | 'NARRATION' | 'MIXAGE' | 'LIVRAISON'

export default function DashboardPage() {
  const {  data: session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortOption>('deadline')
  const [deptFilter, setDeptFilter] = useState<DepartmentFilter>('TOUS')

  const user: DemoUser | null = session?.user as DemoUser || demoUser
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  useEffect(() => {
    if (user) fetchProjects()
  }, [user, statusFilter, sortBy, deptFilter])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (deptFilter !== 'TOUS') params.append('workflowStep', deptFilter)
      params.append('sortBy', sortBy)
      const res = await fetch(`/api/projects?${params.toString()}`)
      if (!res.ok) throw new Error()
      setProjects(await res.json())
    } catch {
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
      if (!res.ok) throw new Error()
      toast.success('Projet mis à jour')
      fetchProjects()
    } catch {
      toast.error('Échec de la mise à jour')
    }
  }

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'FAIT': return <Badge className="bg-emerald-500 text-white border-0 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Fait</Badge>
      case 'EN_COURS': return <Badge className="bg-amber-500 text-white border-0 text-xs"><Clock className="w-3 h-3 mr-1" />En cours</Badge>
      case 'PAS_ENCORE': return <Badge className="bg-slate-400 text-white border-0 text-xs"><Circle className="w-3 h-3 mr-1" />Pas encore</Badge>
      case 'ANNULE': return <Badge className="bg-red-400 text-white border-0 text-xs">Annulé</Badge>
      default: return <Badge className="text-xs">{s}</Badge>
    }
  }

  const getWorkflowBadge = (step: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      REDACTION: { label: 'Rédaction', cls: 'bg-blue-100 text-blue-700' },
      NARRATION: { label: 'Narration', cls: 'bg-purple-100 text-purple-700' },
      MIXAGE: { label: 'Mixage', cls: 'bg-orange-100 text-orange-700' },
      LIVRAISON: { label: 'Livraison', cls: 'bg-teal-100 text-teal-700' },
      TERMINE: { label: 'Terminé', cls: 'bg-emerald-100 text-emerald-700' },
    }
    const c = map[step]
    return c ? <Badge className={`${c.cls} border-0 text-xs`}>{c.label}</Badge> : null
  }

  const getDeadlineBadge = (deadline: string) => {
    const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hours < 0) return <Badge className="bg-red-500 text-white border-0 text-xs"><AlertCircle className="w-3 h-3 mr-1" />En retard</Badge>
    if (hours < 48) return <Badge className="bg-orange-500 text-white border-0 text-xs"><AlertCircle className="w-3 h-3 mr-1" />Bientôt</Badge>
    return null
  }

  const stats = {
    total: projects.length,
    fait: projects.filter(p => p.status === 'FAIT').length,
    enCours: projects.filter(p => p.status === 'EN_COURS').length,
    pasEncore: projects.filter(p => p.status === 'PAS_ENCORE').length,
  }

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Tableau de bord
            </h1>
            <p className="text-muted-foreground">Bon retour, {user?.name}</p>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push('/admin')} className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
              <Users className="h-4 w-4" />Administration
            </Button>
          )}
        </div>

       {/* Attendance Live Widget */}
{!isDemo && user?.id && (
  <div>
    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
      <Clock className="h-5 w-5 text-indigo-500" />
      {isAdmin ? "Présence de l'équipe (Temps réel)" : "Ma présence aujourd'hui"}
    </h2>
    {isAdmin ? (
      <AdminAttendanceView />
    ) : (
      <AttendanceSection userId={user.id} />
    )}
  </div>
)}

        {/* Stats globales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-indigo-200 hover:border-indigo-400 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-200 hover:border-emerald-400 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />Faits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{stats.fait}</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-200 hover:border-amber-400 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />En cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats.enCours}</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-slate-200 hover:border-slate-400 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Circle className="h-4 w-4 text-slate-600" />Pas encore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-600">{stats.pasEncore}</div>
            </CardContent>
          </Card>
        </div>

        {/* Projets par département */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-500" />Projets par département
            </h2>
            <div className="flex gap-2">
              <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v as DepartmentFilter)}>
                <SelectTrigger className="w-[180px] border-indigo-200">
                  <SelectValue placeholder="Département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOUS">Tous</SelectItem>
                  <SelectItem value="REDACTION">Rédaction</SelectItem>
                  <SelectItem value="NARRATION">Narration</SelectItem>
                  <SelectItem value="MIXAGE">Mixage</SelectItem>
                  <SelectItem value="LIVRAISON">Livraison</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[180px] border-indigo-200">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
                  <SelectItem value="EN_COURS">En cours</SelectItem>
                  <SelectItem value="FAIT">Faits</SelectItem>
                  <SelectItem value="ANNULE">Annulés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Projects Grid */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col border-2 border-indigo-100 hover:border-indigo-300 transition-all hover:shadow-xl">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-1">{project.name}</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {[project.seriesName, project.season && `S${project.season}`, project.episodeNumber && `Ép.${project.episodeNumber}`].filter(Boolean).join(' · ')}
                      </CardDescription>
                      {project.clientName && <p className="text-xs text-muted-foreground mt-0.5">{project.clientName}</p>}
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {getWorkflowBadge(project.workflowStep)}
                    {project.broadcastChannel && <Badge variant="outline" className="text-xs">{project.broadcastChannel}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {project.pageCount && (
                      <div>
                        <p className="text-muted-foreground text-xs">Pages</p>
                        <p className="font-semibold">{project.pageCount}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Date limite</p>
                      <p className="font-semibold">
                        {new Date(project.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  {getDeadlineBadge(project.deadline)}
                </CardContent>
                <CardFooter className="flex gap-2 pt-4">
                  {project.status !== 'FAIT' && project.status !== 'ANNULE' && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1 border-emerald-300 hover:bg-emerald-50 text-emerald-700"
                      onClick={() => updateProjectStatus(project.id, 'FAIT')}>
                      <CheckCircle2 className="h-3 w-3" />Marquer fait
                    </Button>
                  )}
                  {project.status === 'PAS_ENCORE' && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1 border-amber-300 hover:bg-amber-50 text-amber-700"
                      onClick={() => updateProjectStatus(project.id, 'EN_COURS')}>
                      <Clock className="h-3 w-3" />Commencer
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          {projects.length === 0 && (
            <Card className="p-12 border-2 border-dashed border-indigo-200">
              <div className="text-center space-y-4">
                <FileText className="h-12 w-12 text-indigo-300 mx-auto" />
                <h3 className="text-lg font-medium">Aucun projet trouvé</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== 'ALL' || deptFilter !== 'TOUS' ? 'Essayez de changer les filtres' : "Vous n'avez pas encore de projet assigné"}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}