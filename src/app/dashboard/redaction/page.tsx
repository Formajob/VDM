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
import {
  FileText, Clock, CheckCircle2, Circle, XCircle,
  ChevronDown, ChevronRight, Search, Filter,
  Calendar, Hash, Tv, AlertCircle, Edit3, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

// ─── Types ───────────────────────────────────────────────
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
  writingDate: string | null
  isWritten: boolean
  status: 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'ANNULE'
  workflowStep: string
  comment: string | null
  redacteurId: string | null
  redacteur: Redacteur | null
}

interface GroupedRedacteur {
  redacteur: Redacteur
  projects: Project[]
}

type StatusFilter = 'ALL' | 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'ANNULE'

// ─── Helpers ─────────────────────────────────────────────
const STATUS_CONFIG = {
  FAIT:      { label: 'Fait',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  EN_COURS:  { label: 'En cours',   color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Clock },
  PAS_ENCORE:{ label: 'Pas encore', color: 'bg-slate-100 text-slate-600 border-slate-200',       icon: Circle },
  ANNULE:    { label: 'Annulé',     color: 'bg-red-100 text-red-600 border-red-200',             icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!cfg) return <Badge variant="outline" className="text-xs">{status}</Badge>
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
  if (hours < 0) return <span className="text-red-600 font-semibold text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formatted}</span>
  if (hours < 48) return <span className="text-orange-500 font-semibold text-xs">{formatted}</span>
  return <span className="text-slate-600 text-xs">{formatted}</span>
}

// ─── Modal d'édition ─────────────────────────────────────
interface EditModalProps {
  project: Project | null
  onClose: () => void
  onSave: (id: string, data: { status: string; pageCount: number | null; writingDate: string | null; comment: string }) => Promise<void>
  isAdmin: boolean
}

function EditModal({ project, onClose, onSave, isAdmin }: EditModalProps) {
  const [status, setStatus] = useState(project?.status || 'PAS_ENCORE')
  const [pageCount, setPageCount] = useState(project?.pageCount?.toString() || '')
  const [writingDate, setWritingDate] = useState(
    project?.writingDate ? new Date(project.writingDate).toISOString().split('T')[0] : ''
  )
  const [comment, setComment] = useState(project?.comment || '')
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const handleSave = async () => {
    setSaving(true)
    await onSave(project.id, {
      status,
      pageCount: pageCount ? parseInt(pageCount) : null,
      writingDate: writingDate || null,
      comment,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Edit3 className="w-4 h-4 text-indigo-500" />
            {project.seriesName}
            {project.season && ` S${project.season}`}
            {project.episodeNumber && ` Ép.${project.episodeNumber}`}
          </DialogTitle>
          {project.projectCode && (
            <p className="text-xs text-muted-foreground font-mono mt-1">{project.projectCode}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Statut */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
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

          {/* Nb pages + Date rédaction */}
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
                value={writingDate}
                onChange={e => setWritingDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Commentaire */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Commentaire</Label>
            <Textarea
              placeholder="Observations, notes..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="resize-none h-20 text-sm"
            />
          </div>

          {/* Infos lecture seule */}
          <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div><span className="font-medium">Échéance :</span> {new Date(project.deadline).toLocaleDateString('fr-FR')}</div>
            {project.broadcastChannel && <div><span className="font-medium">Chaîne :</span> {project.broadcastChannel}</div>}
            {project.startDate && <div><span className="font-medium">Réception :</span> {new Date(project.startDate).toLocaleDateString('fr-FR')}</div>}
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

// ─── Ligne de projet ─────────────────────────────────────
function ProjectRow({ project, onEdit, isAdmin }: { project: Project; onEdit: (p: Project) => void; isAdmin: boolean }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group">
      {/* Titre + code */}
      <td className="py-2.5 px-3">
        <div className="flex flex-col">
          <span className="font-medium text-sm text-slate-800 leading-tight">
            {project.seriesName}
            {project.season && <span className="text-slate-500"> S{project.season}</span>}
            {project.episodeNumber && <span className="text-slate-500"> Ép.{project.episodeNumber}</span>}
          </span>
          {project.projectCode && (
            <span className="text-xs text-slate-400 font-mono truncate max-w-[200px]">{project.projectCode}</span>
          )}
        </div>
      </td>

      {/* Chaîne */}
      <td className="py-2.5 px-3 hidden md:table-cell">
        {project.broadcastChannel ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <Tv className="w-3 h-3 text-slate-400" />{project.broadcastChannel}
          </span>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Échéance */}
      <td className="py-2.5 px-3">
        <DeadlineCell deadline={project.deadline} />
      </td>

      {/* Pages */}
      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        {project.pageCount != null ? (
          <span className="text-sm font-semibold text-slate-700">{project.pageCount}</span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      {/* Date rédaction */}
      <td className="py-2.5 px-3 hidden lg:table-cell">
        {project.writingDate ? (
          <span className="text-xs text-slate-600">
            {new Date(project.writingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      {/* Statut */}
      <td className="py-2.5 px-3">
        <StatusBadge status={project.status} />
      </td>

      {/* Action */}
      <td className="py-2.5 px-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          onClick={() => onEdit(project)}
        >
          <Edit3 className="w-3.5 h-3.5" />
        </Button>
      </td>
    </tr>
  )
}

// ─── Groupe rédacteur (Admin) ─────────────────────────────
function RedacteurGroup({
  redacteur,
  projects,
  onEdit,
  statusFilter,
  search,
}: {
  redacteur: Redacteur
  projects: Project[]
  onEdit: (p: Project) => void
  statusFilter: StatusFilter
  search: string
}) {
  const [open, setOpen] = useState(true)

  const filtered = projects.filter(p => {
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
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
  }

  if (filtered.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header rédacteur */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-white hover:from-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-indigo-500" />}
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
            {redacteur.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-slate-800">{redacteur.name}</p>
            <p className="text-xs text-slate-500">{filtered.length} projet{filtered.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Mini stats */}
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
        </div>
      </button>

      {/* Table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Projet</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Chaîne</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Échéance</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Pages</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date rédaction</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Statut</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <ProjectRow key={p.id} project={p} onEdit={onEdit} isAdmin={true} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────
export default function RedactionPage() {
  const { data: sessionData, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()

  const [grouped, setGrouped] = useState<GroupedRedacteur[]>([])
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const user: DemoUser | null = (sessionData?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/projects/redaction')
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.isAdmin) {
        setGrouped(data.grouped)
      } else {
        setMyProjects(data.projects)
      }
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  const handleSave = async (
    id: string,
    data: { status: string; pageCount: number | null; writingDate: string | null; comment: string }
  ) => {
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

  // Filtrage pour la vue membre
  const filteredMyProjects = myProjects.filter(p => {
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
    const matchSearch = !search ||
      p.seriesName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(search.toLowerCase()) ||
      p.broadcastChannel?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // Stats globales pour admin
  const allProjects = grouped.flatMap(g => g.projects)
  const globalStats = isAdmin ? {
    total: allProjects.length,
    fait: allProjects.filter(p => p.status === 'FAIT').length,
    enCours: allProjects.filter(p => p.status === 'EN_COURS').length,
    pasEncore: allProjects.filter(p => p.status === 'PAS_ENCORE').length,
  } : {
    total: myProjects.length,
    fait: myProjects.filter(p => p.status === 'FAIT').length,
    enCours: myProjects.filter(p => p.status === 'EN_COURS').length,
    pasEncore: myProjects.filter(p => p.status === 'PAS_ENCORE').length,
  }

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-sm text-muted-foreground">Chargement des projets...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
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

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            Tous · {globalStats.total}
          </button>
          <button
            onClick={() => setStatusFilter('PAS_ENCORE')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === 'PAS_ENCORE'
                ? 'bg-slate-600 text-white border-slate-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            <Circle className="inline w-3 h-3 mr-1" />Pas encore · {globalStats.pasEncore}
          </button>
          <button
            onClick={() => setStatusFilter('EN_COURS')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === 'EN_COURS'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
            }`}
          >
            <Clock className="inline w-3 h-3 mr-1" />En cours · {globalStats.enCours}
          </button>
          <button
            onClick={() => setStatusFilter('FAIT')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === 'FAIT'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <CheckCircle2 className="inline w-3 h-3 mr-1" />Fait · {globalStats.fait}
          </button>
          <button
            onClick={() => setStatusFilter('ANNULE')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === 'ANNULE'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
            }`}
          >
            <XCircle className="inline w-3 h-3 mr-1" />Annulé
          </button>

          {/* Recherche */}
          <div className="ml-auto relative">
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

        {/* ── VUE ADMIN : groupée par rédacteur ── */}
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
                  statusFilter={statusFilter}
                  search={search}
                />
              ))
            )}
          </div>
        )}

        {/* ── VUE MEMBRE : ses projets ── */}
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
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Chaîne</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Échéance</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Pages</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date rédaction</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Statut</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMyProjects.map(p => (
                      <ProjectRow key={p.id} project={p} onEdit={setEditingProject} isAdmin={false} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal édition */}
        <EditModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleSave}
          isAdmin={isAdmin}
        />
      </div>
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
      <p className="text-slate-500 font-medium">Aucun projet de rédaction</p>
      <p className="text-slate-400 text-sm mt-1">Les projets assignés apparaîtront ici</p>
    </div>
  )
}
