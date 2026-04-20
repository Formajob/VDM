'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Clock, CheckCircle2, Circle, AlertCircle,
  Zap, Users, TrendingUp, Briefcase, Activity, UserCheck,
  AlertTriangle, Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'
import AdminAttendanceView from '@/components/AdminAttendanceView'
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
type DepartmentFilter = 'TOUS' | 'REDACTION' | 'NARRATION' | 'MIXAGE' | 'LIVREUR'

// ✅ TYPES POUR LES FILTRES DE PRÉSENCE
type AttendanceFilterType = 'all' | 'active' | 'inactive' | 'alerts' | 'redacteurs' | 'studios'

interface FilterBox {
  id: AttendanceFilterType
  label: string
  count: number
  icon: any
  color: string
  bgColor: string
}

export default function DashboardPage() {
  const {   data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortOption>('deadline')
  const [deptFilter, setDeptFilter] = useState<DepartmentFilter>('TOUS')
  
  // ✅ STATES POUR LES FILTRES DE PRÉSENCE
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilterType>('all')
  const [members, setMembers] = useState<any[]>([])
  const [activeMembers, setActiveMembers] = useState<string[]>([])
  const [inactiveMembers, setInactiveMembers] = useState<string[]>([])
  const [membersWithAlerts, setMembersWithAlerts] = useState<string[]>([])

  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null 
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  useEffect(() => {
    if (user) fetchProjects()
  }, [user, statusFilter, sortBy, deptFilter])

  // ✅ FETCH TEAM DATA POUR LES FILTRES (CORRIGÉ)
useEffect(() => {
  async function fetchTeamData() {
    if (!isAdmin) return
    
    try {
      // Fetch members
      const usersRes = await fetch('/api/users')
const usersData = await usersRes.json()
const users = usersData.users || []  // ← ← ← Extraire l'array depuis l'objet
const membersList = users.filter((u: any) => u.role === 'MEMBER')
setMembers(membersList)
      
      // Fetch today's attendance
      const today = new Date().toISOString().split('T')[0]
      const attendanceRes = await fetch(`/api/attendance?all=true&date=${today}`)
      const records = await attendanceRes.json()
      
      // ✅ ACTIFS: Utilisateurs UNIQUES connectés MAINTENANT
      const activeUserIds = new Set(
        records
          .filter((r: any) => !r.endedAt && r.status !== 'ABSENT')
          .map((r: any) => r.userId)
      )
      setActiveMembers(Array.from(activeUserIds) as string[])
      
      // ✅ INACTIFS: Utilisateurs UNIQUES sans pointage aujourd'hui
      const allUserIdsWithRecords = new Set(records.map((r: any) => r.userId))
      const inactive = membersList
        .filter(m => !allUserIdsWithRecords.has(m.id))
        .map(m => m.id)
      setInactiveMembers(inactive)
      
      // ✅ ALERTES: Utilisateurs UNIQUES avec alerte (retard, départ anticipé, absent)
      const alertUserIds = new Set(
        records
          .filter((r: any) => 
            r.isLate || 
            r.status === 'ABSENT' || 
            r.lateMinutes === 999 ||
            r.isEarlyDeparture ||
            (r.earlyMinutes && r.earlyMinutes > 0)
          )
          .map((r: any) => r.userId)
      )
      setMembersWithAlerts(Array.from(alertUserIds) as string[])
      
    } catch (error) {
      console.error('Error fetching team ', error)
    }
  }
  
  fetchTeamData()
}, [isAdmin])

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

  // ✅ CONFIGURATION DES BOXES DE FILTRAGE (CORRIGÉE)
  const filterBoxes: FilterBox[] = [
    { id: 'all', label: 'Tous', count: members.length, icon: Users, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { id: 'active', label: 'Actifs', count: activeMembers.length, icon: Activity, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { id: 'inactive', label: 'Inactifs', count: inactiveMembers.length, icon: UserCheck, color: 'text-slate-600', bgColor: 'bg-slate-50' },
    { id: 'alerts', label: 'Alertes', count: membersWithAlerts.length, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
    { id: 'redacteurs', label: 'Rédacteurs', count: members.filter(m => m.jobRole === 'REDACTEUR').length, icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    // ✅ APRÈS - Inclut tous les rôles studio (NARRATION, TECH_SON, LIVREUR, etc.)
{ id: 'studios', label: 'Studios', count: members.filter(m => {
    const studioRoles = ['TECH_SON', 'NARRATEUR', 'NARRATOR', 'NARRATION', 'LIVREUR', 'LIVRAISON']  // ✅ Ajout de 'NARRATEUR'
    return studioRoles.includes(m.jobRole)
  }).length, icon: Clock, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ]

  // ✅ FILTRER LES MEMBRES AFFICHÉS (CORRIGÉ)
// ✅ FILTRER LES MEMBRES AFFICHÉS (CORRIGÉ)
const getFilteredMemberIds = (): string[] => {
  if (attendanceFilter === 'all') {
    return members.map(m => m.id)
  }
  if (attendanceFilter === 'active') {
    return activeMembers
  }
  if (attendanceFilter === 'inactive') {
    return inactiveMembers
  }
  if (attendanceFilter === 'alerts') {
    return membersWithAlerts
  }
  if (attendanceFilter === 'redacteurs') {
    return members.filter(m => m.jobRole === 'REDACTEUR').map(m => m.id)
  }
  if (attendanceFilter === 'studios') {
    const studioRoles = ['TECH_SON', 'NARRATEUR', 'NARRATOR', 'NARRATION', 'LIVREUR', 'LIVRAISON']
    return members.filter(m => studioRoles.includes(m.jobRole)).map(m => m.id)
  }
  // ✅ RETURN PAR DÉFAUT (corrige l'erreur TypeScript)
  return members.map(m => m.id)
}

  const filteredMemberIds = getFilteredMemberIds()

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

        {/* ✅ PRÉSENCES AVEC FILTRES BOXES */}
        {!isDemo && user?.id && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                {isAdmin ? "Présence de l'équipe (Temps réel)" : "Ma présence aujourd'hui"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {filteredMemberIds.length} membre{filteredMemberIds.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* ✅ BOXES DE FILTRAGE */}
            {isAdmin && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
                {filterBoxes.map(box => {
                  const Icon = box.icon
                  const isActive = attendanceFilter === box.id
                  return (
                    <button
                      key={box.id}
                      onClick={() => setAttendanceFilter(box.id)}
                      className={`
                        p-3 rounded-lg border-2 transition-all duration-200 text-center
                        ${isActive 
                          ? `${box.bgColor} ${box.color} border-current shadow-md` 
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? box.color : 'text-slate-400'}`} />
                      <p className={`text-[10px] font-medium ${isActive ? box.color : 'text-slate-600'}`}>{box.label}</p>
                      <p className={`text-lg font-bold ${isActive ? box.color : 'text-slate-800'}`}>{box.count}</p>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ✅ AFFICHAGE FILTRÉ */}
            {isAdmin ? (
              <AdminAttendanceView 
                showOnlyRealtime={true}
                filterMemberIds={filteredMemberIds}
              />
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

       
      </div>
    </DashboardLayout>
  )
}