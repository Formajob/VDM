'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Package, PlayCircle, CheckCircle2, AlertTriangle, Eye,
  AlertCircle, Search, Circle, Clock, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface Project {
  id: string
  name: string
  seriesName: string
  season: string | null
  episodeNumber: string | null
  broadcastChannel: string | null
  projectCode: string | null
  projectType: string | null
  deadline: string
  durationMin: number | null
  pageCount: number | null
  mixStatus: string | null
  techSonId: string | null
  redacteurId: string | null
  createdAt: string
  mixStartedAt: string | null
  mixedAt: string | null
  comment: string | null
  User: { id: string; name: string } | null
  User_1: { id: string; name: string } | null
}

interface TechSon {
  id: string
  name: string
  jobRole: string
}

interface Stats {
  total: number
  en_attente: number
  en_cours: number
  fait: number
  signale: number
}

type StatusFilter = 'ALL' | 'EN_ATTENTE' | 'EN_COURS' | 'FAIT' | 'SIGNALE'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  FAIT:      { label: 'Fait',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  EN_COURS:  { label: 'En cours',   color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: Clock },
  EN_ATTENTE:{ label: 'En attente', color: 'bg-slate-100 text-slate-600 border-slate-200',       icon: Circle },
  SIGNALE:   { label: 'Signalé',    color: 'bg-red-100 text-red-700 border-red-200',             icon: AlertTriangle },
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) status = 'EN_ATTENTE'
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!cfg) return <span>{status}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function displayDateLocal(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function getProjectTypeLabel(type: string | null) {
  if (!type) return '-'
  switch (type) {
    case 'FILM': return 'Film'
    case 'SERIE': return 'Série'
    case 'EMISSION': return 'Émission'
    default: return type
  }
}

// ✅ CORRECTION 5: Modal avec sélection du Tech Son pour Admin
interface StartModalProps {
  project: Project | null
  techSons: TechSon[]
  onClose: () => void
  onStart: (projectId: string, techSonId: string, comment: string) => Promise<void>
  isAdmin: boolean
}

function StartModal({ project, techSons, onClose, onStart, isAdmin }: StartModalProps) {
  const [selectedTechSon, setSelectedTechSon] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (techSons.length === 1 && !isAdmin) {
      setSelectedTechSon(techSons[0].id)
    }
  }, [techSons, isAdmin])

  if (!project) return null

  const handleStart = async () => {
    if (!selectedTechSon) {
      toast.error('Veuillez sélectionner un tech son')
      return
    }
    setSaving(true)
    await onStart(project.id, selectedTechSon, comment)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-blue-600" />
            Commencer le mixage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Projet:</span>
              <span className="font-medium">{project.seriesName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Durée:</span>
              <span className="font-medium">{project.durationMin || 0} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rédacteur:</span>
              <span className="font-medium">{project.User?.name || '-'}</span>
            </div>
          </div>

          {/* ✅ Admin voit la liste des Tech Sons */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Users className="w-4 h-4" />Assigner à *
              </Label>
              <Select value={selectedTechSon} onValueChange={setSelectedTechSon}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sélectionner un tech son" />
                </SelectTrigger>
                <SelectContent>
                  {techSons.map(ts => (
                    <SelectItem key={ts.id} value={ts.id}>
                      {ts.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Commentaire (optionnel)</Label>
            <Textarea
              placeholder="Observations, notes..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="resize-none h-20 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button 
            size="sm" 
            onClick={handleStart} 
            disabled={saving || (!selectedTechSon && isAdmin)} 
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            {saving ? 'Enregistrement...' : 'Commencer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CompleteModalProps {
  project: Project | null
  onClose: () => void
  onComplete: (projectId: string, comment: string) => Promise<void>
}

function CompleteModal({ project, onClose, onComplete }: CompleteModalProps) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const handleComplete = async () => {
    setSaving(true)
    await onComplete(project.id, comment)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Marquer comme fait
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Projet:</span>
              <span className="font-medium">{project.seriesName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Durée:</span>
              <span className="font-medium">{project.durationMin || 0} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rédacteur:</span>
              <span className="font-medium">{project.User?.name || '-'}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Commentaire (optionnel)</Label>
            <Textarea
              placeholder="Observations, notes..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="resize-none h-20 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button 
            size="sm" 
            onClick={handleComplete} 
            disabled={saving} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {saving ? 'Enregistrement...' : 'Compléter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectRow({ 
  project, 
  onAction,
  onView,
  isAdmin 
}: { 
  project: Project
  onAction: (p: Project, action: 'commencer' | 'fait' | 'signaler', techSonId?: string) => void
  onView: (p: Project) => void
  isAdmin: boolean 
}) {
  return (
    <tr className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="py-2.5 px-4">
        <div className="font-medium text-slate-800">
          {project.seriesName}
          {project.season && <span className="text-slate-500"> S{project.season}</span>}
          {project.episodeNumber && <span className="text-slate-500"> Ép.{project.episodeNumber}</span>}
        </div>
        {project.projectCode && (
          <div className="text-xs text-slate-400 font-mono mt-0.5">{project.projectCode}</div>
        )}
      </td>

      <td className="py-2.5 px-3">
        {displayDateLocal(project.deadline)}
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        <Badge variant="outline" className="text-xs">
          {getProjectTypeLabel(project.projectType)}
        </Badge>
      </td>

      <td className="py-2.5 px-3 hidden lg:table-cell text-center">
        {project.durationMin ? `${project.durationMin} min` : '-'}
      </td>

      <td className="py-2.5 px-3 hidden md:table-cell">
        {project.User?.name || '-'}
      </td>

      <td className="py-2.5 px-3 hidden md:table-cell">
        {project.User_1?.name || <span className="text-slate-400">-</span>}
      </td>

      <td className="py-2.5 px-3 hidden lg:table-cell">
        {displayDateLocal(project.mixedAt)}
      </td>

      <td className="py-2.5 px-3">
        <StatusBadge status={project.mixStatus} />
      </td>

      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {!project.techSonId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => onAction(project, 'commencer')}
              title="Commencer"
            >
              <PlayCircle className="w-3.5 h-3.5" />
            </Button>
          )}
          
          {project.techSonId && project.mixStatus !== 'FAIT' && project.mixStatus !== 'SIGNALE' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => onAction(project, 'fait')}
              title="Fait"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            onClick={() => onView(project)}
            title="Voir détails"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

export default function StudioPage() {
  const {  data: session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [viewingProject, setViewingProject] = useState<Project | null>(null)
  const [startingProject, setStartingProject] = useState<Project | null>(null)
  const [completingProject, setCompletingProject] = useState<Project | null>(null)
  const [techSons, setTechSons] = useState<TechSon[]>([])

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'
  const userJobRole = (user as any)?.jobRole

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  // ✅ CORRECTION 6: Charger la liste des Tech Sons pour l'admin
  const fetchTechSons = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetch('/api/users?jobRole=TECH_SON')
      if (res.ok) {
        const data = await res.json()
        setTechSons(data.users || [])
      }
    } catch {
      console.error('Erreur chargement tech sons')
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) fetchTechSons()
  }, [isAdmin, fetchTechSons])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter.toLowerCase())
      }

      const res = await fetch(`/api/projects/studio?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      
      setProjects(data.projects || [])
      setStats(data.stats || { total: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // ✅ CORRECTION 7: handleAction avec techSonId optionnel
  const handleAction = async (project: Project, action: 'commencer' | 'fait' | 'signaler', techSonId?: string) => {
    if (action === 'commencer') {
      setStartingProject(project)
    } else {
      try {
        const res = await fetch('/api/projects/studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            action,
            techSonId,
            comment: project.comment
          })
        })
        
        if (res.ok) {
          toast.success(action === 'fait' ? 'Projet complété' : 'Projet signalé')
          fetchData()
        } else {
          toast.error('Erreur lors de l\'action')
        }
      } catch {
        toast.error('Erreur de connexion')
      }
    }
  }

  // ✅ CORRECTION 8: handleStart avec techSonId
  const handleStart = async (projectId: string, techSonId: string, comment: string) => {
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'commencer',
          techSonId,
          comment
        })
      })
      
      if (res.ok) {
        toast.success('Projet commencé')
        fetchData()
        setStartingProject(null)
      } else {
        toast.error('Erreur lors du démarrage')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const handleComplete = async (projectId: string, comment: string) => {
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'fait',
          comment
        })
      })
      
      if (res.ok) {
        toast.success('Projet complété')
        fetchData()
        setCompletingProject(null)
      } else {
        toast.error('Erreur lors de la complétion')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const filteredProjects = projects.filter(p => {
    if (!search) return true
    return p.seriesName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(search.toLowerCase())
  })

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isAdmin && !['TECH_SON', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Accès réservé au studio</h2>
          <p className="text-slate-500 mb-4">Ton rôle : <strong>{userJobRole || 'Aucun'}</strong></p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">Retour</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-6 w-6 text-indigo-600" />
              Studio - Mixage
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin ? 'Tous les projets (Admin)' : 'Mes projets en mixage'} • {user?.name}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-600">{stats.en_attente}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">En cours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.en_cours}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Fait</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{stats.fait}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Signalés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{stats.signale}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="EN_ATTENTE">En attente</SelectItem>
              <SelectItem value="EN_COURS">En cours</SelectItem>
              <SelectItem value="FAIT">Fait</SelectItem>
              <SelectItem value="SIGNALE">Signalés</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-full focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white w-44"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-1">Aucun projet</h3>
              <p className="text-sm text-slate-500">Les projets finis en rédaction apparaîtront ici</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-slate-500">Projet</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Échéance</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Type</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Durée</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Rédacteur</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Tech Son</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date mixage</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Statut</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map(p => (
                    <ProjectRow 
                      key={p.id} 
                      project={p} 
                      onAction={handleAction}
                      onView={setViewingProject}
                      isAdmin={isAdmin}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Voir détails */}
        {viewingProject && (
          <Dialog open={!!viewingProject} onOpenChange={() => setViewingProject(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {viewingProject.seriesName}
                  {viewingProject.season && ` S${viewingProject.season}`}
                  {viewingProject.episodeNumber && ` Ép.${viewingProject.episodeNumber}`}
                </DialogTitle>
                {viewingProject.projectCode && (
                  <p className="text-xs text-slate-500 font-mono">{viewingProject.projectCode}</p>
                )}
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Rédacteur:</span> <span className="font-medium">{viewingProject.User?.name || '-'}</span></div>
                  <div><span className="text-slate-500">Tech Son:</span> <span className="font-medium">{viewingProject.User_1?.name || '-'}</span></div>
                  <div><span className="text-slate-500">Durée:</span> <span className="font-medium">{viewingProject.durationMin || 0} min</span></div>
                  <div><span className="text-slate-500">Pages:</span> <span className="font-medium">{viewingProject.pageCount || '-'}</span></div>
                  <div><span className="text-slate-500">Début mix:</span> <span className="font-medium">{displayDateLocal(viewingProject.mixStartedAt)}</span></div>
                  <div><span className="text-slate-500">Mix terminé:</span> <span className="font-medium">{displayDateLocal(viewingProject.mixedAt)}</span></div>
                  <div><span className="text-slate-500">Échéance:</span> <span className="font-medium">{displayDateLocal(viewingProject.deadline)}</span></div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Commentaire</Label>
                  <Textarea
                    value={viewingProject.comment || ''}
                    readOnly
                    className="resize-none h-20 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setViewingProject(null)}>Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ✅ CORRECTION 9: Modal Démarrer avec sélection Tech Son */}
        <StartModal
          project={startingProject}
          techSons={techSons}
          onClose={() => setStartingProject(null)}
          onStart={handleStart}
          isAdmin={isAdmin}
        />

        {/* Modal Compléter */}
        <CompleteModal
          project={completingProject}
          onClose={() => setCompletingProject(null)}
          onComplete={handleComplete}
        />

      </div>
    </DashboardLayout>
  )
}