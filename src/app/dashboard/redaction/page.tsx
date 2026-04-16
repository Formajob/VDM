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
  FileText, Clock, CheckCircle2, Circle, XCircle,
  ChevronDown, ChevronRight, Search,
  Calendar, Hash, Tv, AlertTriangle, Edit3, Save,
  PlayCircle, ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface Redacteur {
  id: string
  name: string
  email?: string
  jobRole: string
}

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
  startDate: string | null
  pageCount: number | null
  durationMin: number | null
  writtenAt: string | null
  isWritten: boolean
  status: 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'ANNULE'
  workflowStep: string
  vsStatus: string | null
  comment: string | null
  redacteurId: string | null
  redacteur: Redacteur | null
}

interface GroupedRedacteur {
  redacteur: Redacteur
  projects: Project[]
}

type StatusFilter = 'ALL' | 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'ANNULE' | 'SIGNALE'

interface Stats {
  total: number
  pas_encore: number
  en_cours: number
  fait: number
  signale: number
}

interface SaveData {
  status: string
  pageCount: number | null
  writtenAt: string | null
  comment: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  FAIT:      { label: 'Fait',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  EN_COURS:  { label: 'En cours',   color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Clock },
  PAS_ENCORE:{ label: 'Pas encore', color: 'bg-slate-100 text-slate-600 border-slate-200',       icon: Circle },
  ANNULE:    { label: 'Annulé',     color: 'bg-red-100 text-red-600 border-red-200',             icon: XCircle },
  SIGNALE:   { label: 'Signalé',    color: 'bg-red-100 text-red-700 border-red-200',             icon: AlertTriangle },
}

function StatusBadge({ status, vsStatus }: { status: string; vsStatus?: string | null }) {
  if (vsStatus === 'SIGNALE') {
    const cfg = STATUS_CONFIG.SIGNALE
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    )
  }
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

function DeadlineCell({ deadline }: { deadline: string }) {
  const date = new Date(deadline)
  const hours = (date.getTime() - Date.now()) / (1000 * 60 * 60)
  const formatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  if (hours < 0) return <span className="text-red-600 font-medium">{formatted}</span>
  if (hours < 48) return <span className="text-amber-600 font-medium">{formatted}</span>
  return <span className="text-slate-600">{formatted}</span>
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

function formatDateLocal(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDateLocal(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

interface EditModalProps {
  project: Project | null
  onClose: () => void
  onSave: (id: string, data: SaveData) => Promise<void>
  isAdmin: boolean
}

function EditModal({ project, onClose, onSave, isAdmin }: EditModalProps) {
  const [status, setStatus] = useState(project?.status || 'PAS_ENCORE')
  const [pageCount, setPageCount] = useState(project?.pageCount?.toString() || '')
  const [writtenAt, setWrittenAt] = useState(formatDateLocal(project?.writtenAt || null))
  const [comment, setComment] = useState(project?.comment || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) {
      setStatus(project.status || 'PAS_ENCORE')
      setPageCount(project.pageCount?.toString() || '')
      setWrittenAt(formatDateLocal(project.writtenAt))
      setComment(project.comment || '')
    }
  }, [project])

  if (!project) return null

  const handleSave = async () => {
    setSaving(true)
    await onSave(project.id, {
      status,
      pageCount: pageCount ? parseInt(pageCount) : null,
      writtenAt: writtenAt || null,
      comment,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {project.seriesName}
            {project.season && ` S${project.season}`}
            {project.episodeNumber && ` Ép.${project.episodeNumber}`}
          </DialogTitle>
          {project.projectCode && (
            <p className="text-xs text-slate-500 font-mono">{project.projectCode}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Statut</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as any)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="FAIT">Fait</SelectItem>
                <SelectItem value="ANNULE">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Hash className="w-3 h-3" />Nombre de pages
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="ex: 12"
                value={pageCount}
                onChange={e => setPageCount(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />Date de rédaction
              </Label>
              <Input
                type="date"
                value={writtenAt}
                onChange={e => setWrittenAt(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Commentaire</Label>
            <Textarea
              placeholder="Observations, notes..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="resize-none h-20 text-sm"
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div><span className="font-medium">Échéance :</span> {displayDateLocal(project.deadline)}</div>
            {project.broadcastChannel && <div><span className="font-medium">Chaîne :</span> {project.broadcastChannel}</div>}
            {project.startDate && <div><span className="font-medium">Réception :</span> {displayDateLocal(project.startDate)}</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CompleteModalProps {
  project: Project | null
  onClose: () => void
  onComplete: (projectId: string, pageCount: number, comment: string, writtenAt: string) => Promise<void>
}

function CompleteModal({ project, onClose, onComplete }: CompleteModalProps) {
  const [pageCount, setPageCount] = useState('')
  const [comment, setComment] = useState('')
  const [writtenAt, setWrittenAt] = useState(formatDateLocal(new Date().toISOString()))
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const handleComplete = async () => {
    if (!pageCount || parseInt(pageCount) <= 0) {
      toast.error('Veuillez entrer un nombre de pages valide')
      return
    }
    setSaving(true)
    await onComplete(project.id, parseInt(pageCount), comment, writtenAt)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Compléter le projet
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
              <span className="text-slate-500">Échéance:</span>
              <span className="font-medium">{displayDateLocal(project.deadline)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Hash className="w-4 h-4" />Nombre de pages *
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="ex: 12"
              value={pageCount}
              onChange={e => setPageCount(e.target.value)}
              className="h-10"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="w-4 h-4" />Date de rédaction *
            </Label>
            <Input
              type="date"
              value={writtenAt}
              onChange={e => setWrittenAt(e.target.value)}
              className="h-10"
            />
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
            disabled={saving || !pageCount} 
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
  onEdit, 
  onAction,
  isAdmin 
}: { 
  project: Project
  onEdit: (p: Project) => void
  onAction: (p: Project, action: 'commencer' | 'completer') => void
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
        <DeadlineCell deadline={project.deadline} />
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        <Badge variant="outline" className="text-xs">
          {getProjectTypeLabel(project.projectType)}
        </Badge>
      </td>

      <td className="py-2.5 px-3 hidden lg:table-cell text-center">
        {project.durationMin ? `${project.durationMin} min` : '-'}
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        {project.pageCount != null ? (
          <span className="text-sm font-semibold text-slate-700">{project.pageCount}</span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      <td className="py-2.5 px-3 hidden md:table-cell">
        {displayDateLocal(project.writtenAt)}
      </td>

      <td className="py-2.5 px-3">
        <StatusBadge status={project.status} vsStatus={project.vsStatus} />
      </td>

      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {project.status === 'PAS_ENCORE' && (
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
          
          {project.status === 'EN_COURS' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => onAction(project, 'completer')}
              title="Compléter"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            onClick={() => onEdit(project)}
            title="Voir détails"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function RedacteurGroup({
  redacteur,
  projects,
  onEdit,
  onAction,
  statusFilter,
  search,
}: {
  redacteur: Redacteur
  projects: Project[]
  onEdit: (p: Project) => void
  onAction: (p: Project, action: 'commencer' | 'completer') => void
  statusFilter: StatusFilter
  search: string
}) {
  const [open, setOpen] = useState(true)

  const filtered = projects.filter(p => {
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter || (statusFilter === 'SIGNALE' && p.vsStatus === 'SIGNALE')
    const matchSearch = !search ||
      p.seriesName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(search.toLowerCase()) ||
      p.broadcastChannel?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const stats = {
    fait: filtered.filter(p => p.status === 'FAIT').length,
    enCours: filtered.filter(p => p.status === 'EN_COURS').length,
    pasEncore: filtered.filter(p => p.status === 'PAS_ENCORE').length,
    signale: filtered.filter(p => p.vsStatus === 'SIGNALE').length,
  }

  if (filtered.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-white hover:from-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-indigo-600" />}
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
            {redacteur.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-slate-800">{redacteur.name}</span>
          <span className="text-xs text-slate-500">({filtered.length} projet{filtered.length > 1 ? 's' : ''})</span>
        </div>

        <div className="flex items-center gap-2 mr-2">
          {stats.fait > 0 && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />{stats.fait}
            </span>
          )}
          {stats.enCours > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />{stats.enCours}
            </span>
          )}
          {stats.pasEncore > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              <Circle className="w-3 h-3" />{stats.pasEncore}
            </span>
          )}
          {stats.signale > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />{stats.signale}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Projet</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Échéance</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Type</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Durée</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Pages</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Date rédaction</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Statut</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <ProjectRow 
                  key={p.id} 
                  project={p} 
                  onEdit={onEdit} 
                  onAction={onAction}
                  isAdmin={true} 
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RedactionPage() {
  const { data: session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  const [grouped, setGrouped] = useState<GroupedRedacteur[]>([])
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pas_encore: 0, en_cours: 0, fait: 0, signale: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortBy, setSortBy] = useState('deadline')
  const [sortOrder, setSortOrder] = useState('asc')
  const [search, setSearch] = useState('')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [completingProject, setCompletingProject] = useState<Project | null>(null)

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL' && statusFilter !== 'SIGNALE') {
        params.set('status', statusFilter.toLowerCase())
      } else if (statusFilter === 'SIGNALE') {
        params.set('status', 'signale')
      }
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)

      const res = await fetch(`/api/projects/redaction?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      
      if (data.isAdmin) {
        setGrouped(data.grouped || [])
      } else {
        setMyProjects(data.projects || [])
      }
      setStats(data.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, signale: 0 })
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sortBy, sortOrder])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  const handleAction = async (project: Project, action: 'commencer' | 'completer') => {
    if (action === 'commencer') {
      try {
        const res = await fetch('/api/projects/redaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            action: 'commencer',
            comment: project.comment
          })
        })
        
        if (res.ok) {
          toast.success('Projet commencé')
          fetchData()
        } else {
          toast.error('Erreur lors de l\'action')
        }
      } catch {
        toast.error('Erreur de connexion')
      }
    } else if (action === 'completer') {
      setCompletingProject(project)
    }
  }

  const handleComplete = async (projectId: string, pageCount: number, comment: string, writtenAt: string) => {
    try {
      const res = await fetch('/api/projects/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'completer',
          pageCount,
          comment,
          writtenAt
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

  const handleSave = async (id: string, data: SaveData) => {
    try {
      const res = await fetch('/api/projects/redaction', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, ...data }),
      })
      if (!res.ok) throw new Error()
      toast.success('Projet mis à jour')
      fetchData()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const filteredMyProjects = myProjects.filter(p => {
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter || (statusFilter === 'SIGNALE' && p.vsStatus === 'SIGNALE')
    const matchSearch = !search ||
      p.seriesName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(search.toLowerCase()) ||
      p.broadcastChannel?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const allProjects = grouped.flatMap(g => g.projects)
  const globalStats = isAdmin ? {
    total: allProjects.length,
    fait: allProjects.filter(p => p.status === 'FAIT').length,
    enCours: allProjects.filter(p => p.status === 'EN_COURS').length,
    pasEncore: allProjects.filter(p => p.status === 'PAS_ENCORE').length,
    signale: allProjects.filter(p => p.vsStatus === 'SIGNALE').length,
  } : {
    total: myProjects.length,
    fait: myProjects.filter(p => p.status === 'FAIT').length,
    enCours: myProjects.filter(p => p.status === 'EN_COURS').length,
    pasEncore: myProjects.filter(p => p.status === 'PAS_ENCORE').length,
    signale: myProjects.filter(p => p.vsStatus === 'SIGNALE').length,
  }

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
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
              <FileText className="h-6 w-6 text-indigo-600" />
              Rédaction
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin
                ? `Dispatch — ${grouped.length} rédacteur${grouped.length > 1 ? 's' : ''}`
                : 'Mes projets assignés'}
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
              <CardTitle className="text-sm text-slate-500">Pas encore</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-600">{stats.pas_encore}</p>
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
              <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
              <SelectItem value="EN_COURS">En cours</SelectItem>
              <SelectItem value="FAIT">Fait</SelectItem>
              <SelectItem value="SIGNALE">Signalés</SelectItem>
              <SelectItem value="ANNULE">Annulé</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">Échéance</SelectItem>
              <SelectItem value="createdAt">Date création</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Croissant</SelectItem>
              <SelectItem value="desc">Décroissant</SelectItem>
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

        {isAdmin && (
          <div className="space-y-4">
            {grouped.length === 0 ? (
              <EmptyState />
            ) : (
              grouped.map(g => (
                <RedacteurGroup
                  key={g.redacteur.id}
                  redacteur={g.redacteur}
                  projects={g.projects}
                  onEdit={setEditingProject}
                  onAction={handleAction}
                  statusFilter={statusFilter}
                  search={search}
                />
              ))
            )}
          </div>
        )}

        {!isAdmin && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {filteredMyProjects.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-slate-500">Projet</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Échéance</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Type</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Durée</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Pages</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Date rédaction</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Statut</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMyProjects.map(p => (
                      <ProjectRow 
                        key={p.id} 
                        project={p} 
                        onEdit={setEditingProject} 
                        onAction={handleAction}
                        isAdmin={false} 
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <EditModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleSave}
          isAdmin={isAdmin}
        />

        <CompleteModal
          project={completingProject}
          onClose={() => setCompletingProject(null)}
          onComplete={handleComplete}
        />

      </div>
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-slate-700 mb-1">Aucun projet de rédaction</h3>
      <p className="text-sm text-slate-500">Les projets assignés apparaîtront ici</p>
    </div>
  )
}