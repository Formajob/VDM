'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, PlayCircle, CheckCircle2, AlertTriangle, Eye, Edit, AlertCircle, Search, Clock, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Circle, Users, UserCheck } from 'lucide-react'
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
  status: string | null
  redacteurId: string | null
  techSonId: string | null
  createdAt: string
  writtenAt: string | null
  comment: string | null
  User: { id: string; name: string } | null
  User_1: { id: string; name: string } | null
}

interface Redacteur {
  id: string
  name: string
  email: string
  jobRole: string
}

interface Stats {
  total: number
  pas_encore: number
  en_cours: number
  fait: number
  en_retard: number
}

type StatusFilter = 'ALL' | 'PAS_ENCORE' | 'EN_COURS' | 'FAIT' | 'EN_RETARD'
type SortField = 'deadline' | 'createdAt' | 'name' | 'durationMin' | 'writtenAt'
type SortOrder = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  FAIT: { label: 'Fait', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  EN_COURS: { label: 'En cours', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  PAS_ENCORE: { label: 'Pas encore', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  EN_RETARD: { label: 'En retard', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) status = 'PAS_ENCORE'
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!cfg) return <span>{status}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
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
  return type === 'FILM' ? 'Film' : 'Série/Émission'
}

// Modal Commencer
function StartModal({ project, onClose, onStart }: any) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const handleStart = async () => {
    setSaving(true)
    await onStart(project.id, comment)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Commencer la rédaction</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Projet:</span><span className="font-medium">{project.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Durée:</span><span className="font-medium">{project.durationMin ? Math.round(project.durationMin) : 0} min</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Échéance:</span><span className="font-medium">{displayDateLocal(project.deadline)}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} className="h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleStart} disabled={saving}>{saving ? '...' : 'Commencer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal Compléter
function CompleteModal({ project, onClose, onComplete }: any) {
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
        <DialogHeader><DialogTitle>Marquer comme fait</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Projet:</span><span className="font-medium">{project.name}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} className="h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleComplete} disabled={saving}>{saving ? '...' : 'Compléter'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal Modifier (Admin seulement)
function EditModal({ project, onClose, onEdit, isAdmin }: any) {
  const [status, setStatus] = useState(project?.status || 'PAS_ENCORE')
  const [writtenAt, setWrittenAt] = useState(project?.writtenAt?.split('T')[0] || '')
  const [pageCount, setPageCount] = useState(project?.pageCount || 0)
  const [durationMin, setDurationMin] = useState(project?.durationMin || 0)
  const [comment, setComment] = useState(project?.comment || '')
  const [saving, setSaving] = useState(false)

  if (!project || !isAdmin) return null

  const handleEdit = async () => {
    setSaving(true)
    await onEdit(project.id, { status, writtenAt, pageCount, durationMin, comment })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" />Modifier le projet</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Projet:</span><span className="font-medium">{project.name}</span></div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
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
            <Label>Date de rédaction</Label>
            <Input type="date" value={writtenAt} onChange={e => setWrittenAt(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Nombre de pages</Label>
            <Input type="number" value={pageCount} onChange={e => setPageCount(parseInt(e.target.value) || 0)} />
          </div>

          <div className="space-y-1.5">
            <Label>Durée (minutes)</Label>
            <Input type="number" step="0.01" value={durationMin} onChange={e => setDurationMin(parseFloat(e.target.value) || 0)} />
          </div>

          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} className="h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleEdit} disabled={saving}>{saving ? '...' : 'Enregistrer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ✅ NOUVEAU: Modal Réassigner Rédacteur
function ReassignModal({ project, redacteurs, onClose, onReassign }: {
  project: Project | null
  redacteurs: Redacteur[]
  onClose: () => void
  onReassign: (projectId: string, newRedacteurId: string) => Promise<void>
}) {
  const [selectedRedacteur, setSelectedRedacteur] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) setSelectedRedacteur(project.redacteurId || '')
  }, [project])

  const handleReassign = async () => {
    if (!selectedRedacteur || !project?.id) {
      toast.error('Veuillez sélectionner un rédacteur')
      return
    }
    if (selectedRedacteur === project.redacteurId) {
      toast.info('Ce rédacteur est déjà assigné')
      onClose()
      return
    }
    setSaving(true)
    await onReassign(project.id, selectedRedacteur)
    setSaving(false)
    onClose()
  }

  if (!project) return null
  const currentRedacteur = redacteurs.find(r => r.id === project.redacteurId)

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Changer de rédacteur
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Projet:</span><span className="font-medium">{project.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rédacteur actuel:</span><span className="font-medium text-indigo-600">{currentRedacteur?.name || 'Non assigné'}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label>Nouveau rédacteur *</Label>
            <Select value={selectedRedacteur} onValueChange={setSelectedRedacteur}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {redacteurs.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} {r.id === project.redacteurId ? '(actuel)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleReassign} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <UserCheck className="w-4 h-4" />
            {saving ? '...' : 'Réassigner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Header Triable
function SortableHeader({ label, field, currentSort, onSort }: any) {
  const isActive = currentSort.field === field
  return (
    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100" onClick={() => onSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (currentSort.order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </div>
    </th>
  )
}

export default function RedactionPage() {
  const {  data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  // États
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [redacteurFilter, setRedacteurFilter] = useState<string>('all')
  const [writtenAtFilter, setWrittenAtFilter] = useState<string>('')
  const [deadlineFilter, setDeadlineFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [search, setSearch] = useState('')
  const [redacteurs, setRedacteurs] = useState<Redacteur[]>([])
  const [viewingProject, setViewingProject] = useState<Project | null>(null)
  const [startingProject, setStartingProject] = useState<Project | null>(null)
  const [completingProject, setCompletingProject] = useState<Project | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [reassigningProject, setReassigningProject] = useState<Project | null>(null)  // ✅ NOUVEAU

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'
  const userJobRole = (user as any)?.jobRole

  // Debug
  useEffect(() => {
    console.log('🔍 [REDACTION] State:', { status, user: user?.name, userJobRole, isAdmin, projectsCount: projects.length })
  }, [status, user, userJobRole, isAdmin, projects.length])

  // Charger les Rédacteurs
  useEffect(() => {
    console.log('🔍 [REDACTION] Loading redacteurs...')
    fetch('/api/users?jobRole=REDACTEUR')
      .then(res => {
        console.log('📡 [REDACTION] Redacteurs response status:', res.status)
        return res.json()
      })
      .then(data => {
        console.log('📦 [REDACTION] Redacteurs ', data)
        if (Array.isArray(data)) {
          setRedacteurs(data)
        } else {
          setRedacteurs([])
        }
      })
      .catch(err => {
        console.error('❌ [REDACTION] Error loading redacteurs:', err)
        setRedacteurs([])
      })
  }, [])

  // Charger les projets
  useEffect(() => {
    if (!user || status !== 'authenticated') {
      console.log(' [REDACTION] Waiting for user authentication...', { user, status })
      return
    }

    console.log('🔍 [REDACTION] Fetching projects...')
    setLoading(true)
    
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
    
    fetch(`/api/projects/redaction?${params.toString()}`)
      .then(res => {
        console.log('📡 [REDACTION] Response status:', res.status)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        console.log('📦 [REDACTION] Projects ', { count: data.projects?.length, stats: data.stats })
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
      })
      .catch(err => {
        console.error('❌ [REDACTION] Error:', err)
        toast.error('Erreur chargement projets')
        setProjects([])
        setStats({ total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user, status, statusFilter])

  // Handlers
  const handleAction = async (project: Project, action: string) => {
    if (action === 'commencer') { setStartingProject(project); return }
    
    try {
      const res = await fetch('/api/projects/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, action, comment: project.comment })
      })
      if (res.ok) {
        toast.success('Action réussie')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/redaction?${params.toString()}`)
        const data = await res2.json()
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
        setLoading(false)
      } else {
        toast.error('Erreur action')
      }
    } catch { toast.error('Erreur connexion') }
  }

  const handleStart = async (projectId: string, comment: string) => {
    try {
      const res = await fetch('/api/projects/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'commencer', comment })
      })
      if (res.ok) {
        toast.success('Projet commencé')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/redaction?${params.toString()}`)
        const data = await res2.json()
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
        setLoading(false)
        setStartingProject(null)
      } else { toast.error('Erreur démarrage') }
    } catch { toast.error('Erreur connexion') }
  }

  const handleComplete = async (projectId: string, comment: string) => {
    try {
      const res = await fetch('/api/projects/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'fait', comment })
      })
      if (res.ok) {
        toast.success('Projet complété')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/redaction?${params.toString()}`)
        const data = await res2.json()
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
        setLoading(false)
        setCompletingProject(null)
      } else { toast.error('Erreur complétion') }
    } catch { toast.error('Erreur connexion') }
  }

  // Handler pour modifier un projet (Admin)
  const handleEdit = async (projectId: string, data: any) => {
    try {
      const res = await fetch('/api/projects/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          action: 'update',
          status: data.status,
          writtenAt: data.writtenAt ? new Date(data.writtenAt).toISOString() : null,
          pageCount: data.pageCount,
          durationMin: data.durationMin,
          comment: data.comment
        })
      })
      if (res.ok) {
        toast.success('Projet modifié')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/redaction?${params.toString()}`)
        const data2 = await res2.json()
        setProjects(data2.projects || [])
        setStats(data2.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
        setLoading(false)
        setEditingProject(null)
      } else { toast.error('Erreur modification') }
    } catch { toast.error('Erreur connexion') }
  }

  // ✅ NOUVEAU: Handler pour réassigner un projet à un autre rédacteur
  const handleReassign = async (projectId: string, newRedacteurId: string) => {
  try {
    const res = await fetch('/api/projects/redaction', {  // ✅ Bon endpoint
      method: 'POST',  // ✅ Bonne méthode
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        projectId, 
        action: 'reassign',  // ✅ Action spécifique
        redacteurId: newRedacteurId 
      })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erreur')
    }
    toast.success('Projet réassigné')
    // Recharger les projets
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
    const res2 = await fetch(`/api/projects/redaction?${params.toString()}`)
    const data = await res2.json()
    setProjects(data.projects || [])
    setStats(data.stats || { total: 0, pas_encore: 0, en_cours: 0, fait: 0, en_retard: 0 })
    setLoading(false)
  } catch (e: any) {
    toast.error(`Erreur: ${e.message}`)
  }
}

  const handleSort = (field: SortField) => {
    setSortField(field)
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Filtrage et tri
  const filteredProjects = [...projects]
    .filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.projectCode?.toLowerCase().includes(search.toLowerCase())) return false
      if (redacteurFilter !== 'all' && p.redacteurId !== redacteurFilter) return false
      if (writtenAtFilter && (!p.writtenAt || !p.writtenAt.startsWith(writtenAtFilter))) return false
      if (deadlineFilter && (!p.deadline || !p.deadline.startsWith(deadlineFilter))) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'deadline': cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime(); break
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
        case 'writtenAt': cmp = new Date(a.writtenAt || 0).getTime() - new Date(b.writtenAt || 0).getTime(); break
        case 'durationMin': cmp = (a.durationMin || 0) - (b.durationMin || 0); break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

  // Stats calculées sur filteredProjects
  const filteredStats = {
    total: filteredProjects.length,
    pas_encore: filteredProjects.filter((p: any) => p.status === 'PAS_ENCORE').length,
    en_cours: filteredProjects.filter((p: any) => p.status === 'EN_COURS').length,
    fait: filteredProjects.filter((p: any) => p.status === 'FAIT').length,
    en_retard: filteredProjects.filter((p: any) => {
      if (!p.deadline) return false
      return new Date(p.deadline) < new Date() && p.status !== 'FAIT'
    }).length,
  }

  // Total Minutes
  const totalMinutes = Math.round(filteredProjects.reduce((sum, p) => sum + (p.durationMin || 0), 0))

  // Loading screen
  if (loading && projects.length === 0) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-slate-500">Chargement...</p>
        </div>
      </DashboardLayout>
    )
  }

  // Access check
  if (!isAdmin && !['REDACTEUR', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold">Accès réservé à la rédaction</h2>
          <p className="text-slate-500">Ton rôle: {userJobRole || 'Aucun'}</p>
          <Button onClick={() => router.push('/dashboard')}>Retour</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />Rédaction
          </h1>
          <p className="text-sm text-muted-foreground">{user?.name}</p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total', value: filteredStats.total },
            { label: 'Pas encore', value: filteredStats.pas_encore, color: 'text-slate-600' },
            { label: 'En cours', value: filteredStats.en_cours, color: 'text-blue-600' },
            { label: 'Fait', value: filteredStats.fait, color: 'text-emerald-600' },
            { label: 'En retard', value: filteredStats.en_retard, color: 'text-red-600' },
            { label: 'Total Minutes', value: totalMinutes, color: 'text-indigo-600', icon: Clock },
          ].map((s, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500 flex items-center gap-1">
                  {s.icon && <s.icon className="w-3 h-3" />}
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent><p className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</p></CardContent>
            </Card>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
              <SelectItem value="EN_COURS">En cours</SelectItem>
              <SelectItem value="FAIT">Fait</SelectItem>
              <SelectItem value="EN_RETARD">En retard</SelectItem>
            </SelectContent>
          </Select>

          <Select value={redacteurFilter} onValueChange={setRedacteurFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Rédacteur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {redacteurs.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={writtenAtFilter} onChange={e => setWrittenAtFilter(e.target.value)} 
                 className="w-40 h-9" placeholder="Date rédaction" title="Filtrer par date de rédaction" />

          <Input type="date" value={deadlineFilter} onChange={e => setDeadlineFilter(e.target.value)} 
                 className="w-40 h-9" placeholder="Échéance" title="Filtrer par date d'échéance" />

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                   className="pl-8 pr-3 py-1.5 text-xs border rounded-full bg-white w-44" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Aucun projet</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    <SortableHeader label="Projet" field="name" currentSort={{ field: sortField, order: sortOrder }} onSort={handleSort} />
                    <SortableHeader label="Échéance" field="deadline" currentSort={{ field: sortField, order: sortOrder }} onSort={handleSort} />
                    <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">Type</th>
                    <SortableHeader label="Durée" field="durationMin" currentSort={{ field: sortField, order: sortOrder }} onSort={handleSort} />
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Rédacteur</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date rédaction</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Statut</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map(p => (
                    <tr key={p.id} className="group border-b hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 max-w-[250px]">
                        <div className="font-medium line-clamp-2" title={p.name}>{p.name}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{displayDateLocal(p.deadline)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-center"><Badge variant="outline" className="text-xs">{getProjectTypeLabel(p.projectType)}</Badge></td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">{p.durationMin ? `${Math.round(p.durationMin)} min` : '-'}</td>
                      
                      {/* ✅ CORRECTION: Colonne Rédacteur avec bouton réassigner (Admin seulement) */}
                      <td className="py-2.5 px-3 whitespace-nowrap hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{p.User?.name || '-'}</span>
                          {isAdmin && (
                            <button
                              onClick={() => setReassigningProject(p)}
                              className="p-1 hover:bg-indigo-50 rounded transition-colors"
                              title="Changer de rédacteur"
                            >
                              <Edit className="w-3.5 h-3.5 text-indigo-600" />
                            </button>
                          )}
                        </div>
                      </td>
                      
                      <td className="py-2.5 px-3 whitespace-nowrap hidden lg:table-cell">{displayDateLocal(p.writtenAt)}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={p.status} /></td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {p.status !== 'FAIT' && <Button size="sm" variant="outline" className="h-7" onClick={() => handleAction(p, 'commencer')}><PlayCircle className="w-3.5 h-3.5" /></Button>}
                          {p.status !== 'FAIT' && <Button size="sm" variant="outline" className="h-7" onClick={() => handleAction(p, 'fait')}><CheckCircle2 className="w-3.5 h-3.5" /></Button>}
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => setViewingProject(p)}><Eye className="w-3.5 h-3.5" /></Button>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" className="h-7 text-amber-600 hover:text-amber-700" onClick={() => setEditingProject(p)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modals */}
        {viewingProject && (
          <Dialog open={!!viewingProject} onOpenChange={() => setViewingProject(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{viewingProject.name}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Rédacteur:</span> <span className="font-medium">{viewingProject.User?.name || '-'}</span></div>
                  <div><span className="text-slate-500">Durée:</span> <span className="font-medium">{viewingProject.durationMin ? Math.round(viewingProject.durationMin) : 0} min</span></div>
                  <div><span className="text-slate-500">Échéance:</span> <span className="font-medium">{displayDateLocal(viewingProject.deadline)}</span></div>
                  <div><span className="text-slate-500">Date rédaction:</span> <span className="font-medium">{displayDateLocal(viewingProject.writtenAt)}</span></div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" size="sm" onClick={() => setViewingProject(null)}>Fermer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ✅ NOUVEAU: Modal Réassigner */}
        {reassigningProject && (
          <ReassignModal
            project={reassigningProject}
            redacteurs={redacteurs}
            onClose={() => setReassigningProject(null)}
            onReassign={handleReassign}
          />
        )}

        {editingProject && (
          <EditModal 
            project={editingProject} 
            onClose={() => setEditingProject(null)} 
            onEdit={handleEdit}
            isAdmin={isAdmin}
          />
        )}

        <StartModal project={startingProject} onClose={() => setStartingProject(null)} onStart={handleStart} />
        <CompleteModal project={completingProject} onClose={() => setCompletingProject(null)} onComplete={handleComplete} />
      </div>
    </DashboardLayout>
  )
}