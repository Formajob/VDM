'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Package, Search, Edit3, Trash2, AlertCircle, Clock,
  CheckCircle2, AlertTriangle, ArrowUp, ArrowDown, RefreshCw, Plus,
  BarChart3, TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

// ✅ CORRECTION 1: Interface Project avec les dates
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
  durationMin: number | null
  pageCount: number | null
  status: string | null
  mixStatus: string | null
  workflowStep: string | null
  redacteurId: string | null
  techSonId: string | null
  createdAt: string
  comment: string | null
  writtenAt: string | null      // ← ← ← AJOUTÉ
  mixedAt: string | null        // ← ← ← AJOUTÉ
  deliveredAt: string | null    // ← ← ← AJOUTÉ
  User: { id: string; name: string } | null
  User_1: { id: string; name: string } | null
}

interface Stats {
  total: number
  dispatch: number
  redaction: number
  studio: number
  livraison: number
  totalMinutes: number
  enRetard: number
  moinsDe7Jours: number
  signales: number
}

// ✅ CORRECTION 2: ProjectFormData avec les dates
interface ProjectFormData {
  id?: string
  name: string
  seriesName: string
  season?: string | null
  episodeNumber?: string | null
  broadcastChannel?: string | null
  projectCode?: string | null
  deadline: string
  startDate?: string | null
  durationMin?: number | null
  pageCount?: number | null
  status: string
  mixStatus: string
  workflowStep: string
  projectType: string
  redacteurId?: string | null
  techSonId?: string | null
  comment?: string | null
  writtenAt?: string | null      // ← ← ← AJOUTÉ
  mixedAt?: string | null        // ← ← ← AJOUTÉ
  deliveredAt?: string | null    // ← ← ← AJOUTÉ
}

type SortField = 'deadline' | 'createdAt' | 'name' | 'durationMin' | 'workflowStep'
type SortOrder = 'asc' | 'desc'

const WORKFLOW_COLORS: Record<string, string> = {
  DISPATCH: 'bg-slate-100 text-slate-700 border-slate-200',
  REDACTION: 'bg-blue-100 text-blue-700 border-blue-200',
  STUDIO: 'bg-purple-100 text-purple-700 border-purple-200',
  LIVRAISON: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const STATUS_COLORS: Record<string, string> = {
  PAS_ENCORE: 'bg-slate-100 text-slate-600',
  EN_COURS: 'bg-blue-100 text-blue-700',
  FAIT: 'bg-emerald-100 text-emerald-700',
  SIGNALE: 'bg-red-100 text-red-700',
}

function WorkflowBadge({ step }: { step: string | null }) {
  if (!step) step = 'DISPATCH'
  const color = WORKFLOW_COLORS[step] || WORKFLOW_COLORS.DISPATCH
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {step}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) status = 'PAS_ENCORE'
  const color = STATUS_COLORS[status] || STATUS_COLORS.PAS_ENCORE
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  )
}

function displayDateLocal(dateString: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function getDaysUntilDeadline(deadline: string): number {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffTime = deadlineDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// ─── Modal Édition Projet ───────────────────────────────────
function EditProjectModal({ project, onClose, onSave, onDelete, isNew = false }: {
  project: Project | null
  onClose: () => void
  onSave: (formData: ProjectFormData) => Promise<void>
  onDelete: (projectId: string) => Promise<void>
  isNew?: boolean
}) {
  // ✅ CORRECTION 3: Initialisation formData avec les nouvelles dates
  const [formData, setFormData] = useState<ProjectFormData>({
    id: project?.id || '',
    name: project?.name || '',
    seriesName: project?.seriesName || '',
    season: project?.season || '',
    episodeNumber: project?.episodeNumber || '',
    broadcastChannel: project?.broadcastChannel || '',
    projectCode: project?.projectCode || '',
    deadline: project?.deadline ? project.deadline.split('T')[0] : new Date().toISOString().split('T')[0],
    startDate: project?.startDate ? project.startDate.split('T')[0] : '',
    durationMin: project?.durationMin || 0,
    pageCount: project?.pageCount || 0,
    status: project?.status || 'PAS_ENCORE',
    mixStatus: project?.mixStatus || 'PAS_ENCORE',
    workflowStep: project?.workflowStep || 'DISPATCH',
    projectType: project?.projectType || 'SERIE_EMISSION',
    redacteurId: project?.redacteurId || '',
    techSonId: project?.techSonId || '',
    comment: project?.comment || '',
    writtenAt: project?.writtenAt ? project.writtenAt.split('T')[0] : '',      // ← ← ← AJOUTÉ
    mixedAt: project?.mixedAt ? project.mixedAt.split('T')[0] : '',            // ← ← ← AJOUTÉ
    deliveredAt: project?.deliveredAt ? project.deliveredAt.split('T')[0] : '', // ← ← ← AJOUTÉ
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = (k: keyof ProjectFormData, v: any) => 
    setFormData(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!formData.name || !formData.deadline) {
      toast.error('Nom et échéance requis')
      return
    }
    setSaving(true)
    await onSave(formData)
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!project?.id) return
    if (!confirm('Supprimer ce projet ? Action irréversible.')) return
    setDeleting(true)
    await onDelete(project.id)
    setDeleting(false)
    onClose()
  }

  const daysLeft = project?.deadline ? getDaysUntilDeadline(project.deadline) : null
  const isLate = daysLeft !== null && daysLeft < 0
  const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              {isNew ? 'Nouveau projet' : 'Modifier le projet'}
            </span>
            {!isNew && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
                <Trash2 className="w-4 h-4" />
                {deleting ? '...' : 'Supprimer'}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {(isLate || isSoon) && project && (
          <div className={`rounded-lg p-3 flex items-center gap-2 ${isLate ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isLate ? `⚠️ En retard de ${Math.abs(daysLeft)} jour(s)` : `⏰ Échéance dans ${daysLeft} jour(s)`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-2">
          <div className="col-span-2 md:col-span-3 space-y-1.5">
            <Label>Nom du projet *</Label>
            <Input value={formData.name} onChange={e => set('name', e.target.value)} className="font-mono text-xs" />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Série / Titre *</Label>
            <Input value={formData.seriesName} onChange={e => set('seriesName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Code projet</Label>
            <Input value={formData.projectCode || ''} onChange={e => set('projectCode', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Saison</Label>
            <Input value={formData.season || ''} onChange={e => set('season', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Épisode</Label>
            <Input value={formData.episodeNumber || ''} onChange={e => set('episodeNumber', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={formData.projectType} onValueChange={v => set('projectType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SERIE_EMISSION">Série/Émission</SelectItem>
                <SelectItem value="FILM">Film</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Chaîne</Label>
            <Input value={formData.broadcastChannel || ''} onChange={e => set('broadcastChannel', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Durée (min)</Label>
            <Input type="number" value={formData.durationMin || 0} onChange={e => set('durationMin', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pages</Label>
            <Input type="number" value={formData.pageCount || 0} onChange={e => set('pageCount', parseInt(e.target.value) || 0)} />
          </div>

          <div className="space-y-1.5">
            <Label>Date réception</Label>
            <Input type="date" value={formData.startDate || ''} onChange={e => set('startDate', e.target.value)} />
          </div>
          
          {/* ✅ CORRECTION 4: Ajout des 3 champs dates dans le modal */}
          <div className="space-y-1.5">
            <Label>📝 Date rédaction</Label>
            <Input type="date" value={formData.writtenAt || ''} onChange={e => set('writtenAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>🎙️ Date mixage</Label>
            <Input type="date" value={formData.mixedAt || ''} onChange={e => set('mixedAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>📤 Date livraison</Label>
            <Input type="date" value={formData.deliveredAt || ''} onChange={e => set('deliveredAt', e.target.value)} />
          </div>
          
          <div className="space-y-1.5">
            <Label>Échéance *</Label>
            <Input type="date" value={formData.deadline} onChange={e => set('deadline', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Workflow *</Label>
            <Select value={formData.workflowStep} onValueChange={v => set('workflowStep', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DISPATCH">Dispatch</SelectItem>
                <SelectItem value="REDACTION">Rédaction</SelectItem>
                <SelectItem value="STUDIO">Studio</SelectItem>
                <SelectItem value="LIVRAISON">Livraison</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Statut rédaction</Label>
            <Select value={formData.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="FAIT">Fait</SelectItem>
                <SelectItem value="SIGNALE">Signalé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Statut mixage</Label>
            <Select value={formData.mixStatus} onValueChange={v => set('mixStatus', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="FAIT">Fait</SelectItem>
                <SelectItem value="SIGNALE">Signalé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Input value={formData.comment || ''} onChange={e => set('comment', e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Ligne Projet ──────────────────────────────────────────
function ProjectRow({ project, onEdit, onDelete }: {
  project: Project
  onEdit: (p: Project) => void
  onDelete: (id: string) => void
}) {
  const daysLeft = getDaysUntilDeadline(project.deadline)
  const isLate = daysLeft < 0
  const isSoon = daysLeft >= 0 && daysLeft <= 7

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      <td className="py-2.5 px-3 max-w-[200px]">
        <div className="font-medium text-sm text-slate-800 truncate" title={project.name}>
          {project.name}
        </div>
        {project.projectCode && (
          <div className="text-xs text-slate-400 font-mono truncate">{project.projectCode}</div>
        )}
      </td>

      {/* ✅ CORRECTION 5: Colonne "Série" RETIRÉE */}
      {/* <td className="py-2.5 px-3 hidden md:table-cell">...</td> */}

      <td className="py-2.5 px-3 hidden lg:table-cell">
        <WorkflowBadge step={project.workflowStep} />
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell">
        <StatusBadge status={project.status} />
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell">
        <StatusBadge status={project.mixStatus} />
      </td>

      {/* ✅ CORRECTION 6: Colonne "Livraison" AJOUTÉE après "Mixage" */}
      <td className="py-2.5 px-3 hidden md:table-cell">
  {project.deliveredAt ? (
    <Badge className="bg-emerald-100 text-emerald-700 text-xs">FAIT</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-600 text-xs">PAS ENCORE</Badge>
  )}
</td>

      <td className="py-2.5 px-3 hidden md:table-cell">
        <div className="text-sm font-semibold text-indigo-600">
          {project.durationMin ? `${Math.round(project.durationMin)} min` : '—'}
        </div>
      </td>

      <td className="py-2.5 px-3">
        <span className={`text-xs font-medium flex items-center gap-1 ${
          isLate ? 'text-red-600' : isSoon ? 'text-orange-500' : 'text-slate-600'
        }`}>
          {(isLate || isSoon) && <AlertCircle className="w-3 h-3" />}
          {displayDateLocal(project.deadline)}
        </span>
        {isLate && <div className="text-xs text-red-500">{Math.abs(daysLeft)}j retard</div>}
        {isSoon && !isLate && <div className="text-xs text-orange-500">{daysLeft}j restants</div>}
      </td>

      <td className="py-2.5 px-3 hidden lg:table-cell">
        <div className="text-xs text-slate-600">{project.User?.name || '—'}</div>
        <div className="text-xs text-slate-500">{project.User_1?.name || '—'}</div>
      </td>

      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7" onClick={() => onEdit(project)}>
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm('Supprimer ?')) onDelete(project.id) }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── Page Principale ───────────────────────────────────────
export default function ProjectsDashboardPage() {
  const {  data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0, dispatch: 0, redaction: 0, studio: 0, livraison: 0,
    totalMinutes: 0, enRetard: 0, moinsDe7Jours: 0, signales: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  
  // ✅ CORRECTION 7: Navigation mois
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, isAdmin])

  // ✅ CORRECTION 8: fetchData avec filtre par mois de rédaction
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (isAdmin) params.set('includeAll', 'true')
      
      // ✅ Filtre par mois de rédaction (writtenAt)
      const monthStart = new Date(currentMonth.year, currentMonth.month - 1, 1).toISOString().split('T')[0]
      const monthEnd = new Date(currentMonth.year, currentMonth.month, 0).toISOString().split('T')[0]
      params.set('writtenAtFrom', monthStart)
      params.set('writtenAtTo', monthEnd)
      
      const res = await fetch(`/api/projects?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      
      const projectsList = data.projects || []
      setProjects(projectsList)
      
      // Calculer les stats
      const calculatedStats: Stats = {
        total: projectsList.length,
        dispatch: projectsList.filter((p: any) => p.workflowStep === 'DISPATCH').length,
        redaction: projectsList.filter((p: any) => p.workflowStep === 'REDACTION').length,
        studio: projectsList.filter((p: any) => p.workflowStep === 'STUDIO').length,
        livraison: projectsList.filter((p: any) => p.workflowStep === 'LIVRAISON').length,
        totalMinutes: projectsList.reduce((sum: number, p: any) => sum + (p.durationMin || 0), 0),
        enRetard: projectsList.filter((p: any) => {
          if (!p.deadline || p.workflowStep === 'LIVRAISON') return false
          return getDaysUntilDeadline(p.deadline) < 0
        }).length,
        moinsDe7Jours: projectsList.filter((p: any) => {
          if (!p.deadline || p.workflowStep === 'LIVRAISON') return false
          const d = getDaysUntilDeadline(p.deadline)
          return d >= 0 && d <= 7
        }).length,
        signales: projectsList.filter((p: any) => p.status === 'SIGNALE' || p.mixStatus === 'SIGNALE').length,
      }
      setStats(calculatedStats)
    } catch (e) {
      console.error('Erreur chargement:', e)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, currentMonth])  // ← ← ← Ajout de currentMonth dans les dépendances

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  // ✅ CORRECTION 9: handleSaveProject avec formatage des dates
  const handleSaveProject = async (formData: ProjectFormData) => {
    try {
      const method = formData.id ? 'PUT' : 'POST'
      const res = await fetch('/api/projects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // ✅ Formater les dates pour l'API
          writtenAt: formData.writtenAt ? new Date(formData.writtenAt).toISOString() : null,
          mixedAt: formData.mixedAt ? new Date(formData.mixedAt).toISOString() : null,
          deliveredAt: formData.deliveredAt ? new Date(formData.deliveredAt).toISOString() : null,
          startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur')
      }
      toast.success(formData.id ? 'Projet modifié' : 'Projet créé')
      fetchData()
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Projet supprimé')
      fetchData()
    } catch {
      toast.error('Erreur suppression')
    }
  }

  // ✅ CORRECTION 10: Fonction navigation mois
  const changeMonth = (delta: number) => {
    setCurrentMonth(prev => {
      let newMonth = prev.month + delta
      let newYear = prev.year
      if (newMonth > 12) { newMonth = 1; newYear++ }
      if (newMonth < 1) { newMonth = 12; newYear-- }
      return { year: newYear, month: newMonth }
    })
  }

  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const currentMonthLabel = `${monthNames[currentMonth.month - 1]} ${currentMonth.year}`

  const filtered = projects
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name?.toLowerCase().includes(q) ||
        p.seriesName?.toLowerCase().includes(q) ||
        p.projectCode?.toLowerCase().includes(q) ||
        p.comment?.toLowerCase().includes(q)
    })
    .filter(p => {
      if (filterWorkflow === 'all') return true
      return p.workflowStep === filterWorkflow
    })
    .sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'deadline': aVal = a.deadline; bVal = b.deadline; break
        case 'createdAt': aVal = a.createdAt; bVal = b.createdAt; break
        case 'name': aVal = a.name; bVal = b.name; break
        case 'durationMin': aVal = a.durationMin || 0; bVal = b.durationMin || 0; break
        case 'workflowStep': aVal = a.workflowStep; bVal = b.workflowStep; break
        default: return 0
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  if (loading) return (
    <DashboardLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-6 w-6 text-indigo-600" />
              Gestion des Projets
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin ? 'Vue administrateur - Tous les projets' : 'Mes projets assignés'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Actualiser
            </Button>
            {isAdmin && (
              <Button onClick={() => { setEditingProject(null); setShowNewProject(true) }} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4" /> Nouveau
              </Button>
            )}
          </div>
        </div>

        {/* ✅ CORRECTION 11: Navigation mois ajoutée en haut */}
        <div className="flex items-center justify-between bg-white rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => changeMonth(-1)} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg min-w-[120px] text-center">{currentMonthLabel}</span>
            <Button variant="outline" size="sm" onClick={() => changeMonth(1)} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const now = new Date()
              setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() + 1 })
            }} className="text-xs">
              Mois actuel
            </Button>
          </div>
        </div>

        {/* Stats Cards - Workflow */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Dispatch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{stats.dispatch}</div>
              <div className="text-xs text-slate-400">
                {Math.round(projects.filter(p => p.workflowStep === 'DISPATCH').reduce((s, p) => s + (p.durationMin || 0), 0))} min
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Rédaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.redaction}</div>
              <div className="text-xs text-slate-400">
                {Math.round(projects.filter(p => p.workflowStep === 'REDACTION').reduce((s, p) => s + (p.durationMin || 0), 0))} min
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Studio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.studio}</div>
              <div className="text-xs text-slate-400">
                {Math.round(projects.filter(p => p.workflowStep === 'STUDIO').reduce((s, p) => s + (p.durationMin || 0), 0))} min
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Livraison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.livraison}</div>
              <div className="text-xs text-slate-400">
                {Math.round(projects.filter(p => p.workflowStep === 'LIVRAISON').reduce((s, p) => s + (p.durationMin || 0), 0))} min
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <Package className="w-3 h-3" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{stats.total}</div>
              <div className="text-xs text-slate-400">{Math.round(stats.totalMinutes)} min</div>
            </CardContent>
          </Card>
        </div>

        {/* Alertes */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className={stats.enRetard > 0 ? 'border-red-200 bg-red-50/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> En retard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.enRetard}</div>
              <div className="text-xs text-red-400">projets en retard</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> &lt; 7 jours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.moinsDe7Jours}</div>
              <div className="text-xs text-orange-400">échéance proche</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Retours qualité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.signales}</div>
              <div className="text-xs text-amber-400">projets signalés</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres et Recherche */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher (nom, série, code...)" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
          </div>
          <Select value={filterWorkflow} onValueChange={setFilterWorkflow}>
            <SelectTrigger className="w-40 h-10"><SelectValue placeholder="Workflow" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="DISPATCH">Dispatch</SelectItem>
              <SelectItem value="REDACTION">Rédaction</SelectItem>
              <SelectItem value="STUDIO">Studio</SelectItem>
              <SelectItem value="LIVRAISON">Livraison</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-40 h-10"><SelectValue placeholder="Trier par" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">Échéance</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="durationMin">Durée</SelectItem>
              <SelectItem value="workflowStep">Workflow</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="h-10 w-10 p-0">
            {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500">Projet</th>
                  {/* ✅ CORRECTION 12: Colonne "Série" RETIRÉE du tableau */}
                  {/* <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Série</th> */}
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Workflow</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Rédaction</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Mixage</th>
                  {/* ✅ CORRECTION 13: Colonne "Livraison" AJOUTÉE */}
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Livraison</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Durée</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500">Échéance</th>
                  <th className="py-3 px-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center"><Package className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500 font-medium">Aucun projet trouvé</p></td></tr>
                ) : (
                  filtered.map(p => <ProjectRow key={p.id} project={p} onEdit={setEditingProject} onDelete={handleDeleteProject} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        {(editingProject || showNewProject) && (
          <EditProjectModal
            project={editingProject}
            isNew={showNewProject}
            onClose={() => { setEditingProject(null); setShowNewProject(false) }}
            onSave={handleSaveProject}
            onDelete={handleDeleteProject}
          />
        )}
      </div>
    </DashboardLayout>
  )
}