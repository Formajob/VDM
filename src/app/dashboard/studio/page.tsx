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
import { Package, PlayCircle, CheckCircle2, AlertTriangle, Eye, Edit, AlertCircle, Search, Clock, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Circle, Users } from 'lucide-react'
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
  pas_encore: number
  en_attente: number
  en_cours: number
  fait: number
  signale: number
}

type StatusFilter = 'ALL' | 'PAS_ENCORE' | 'EN_ATTENTE' | 'EN_COURS' | 'FAIT' | 'SIGNALE'
type SortField = 'deadline' | 'mixedAt' | 'name' | 'durationMin'
type SortOrder = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  FAIT: { label: 'Fait', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  EN_COURS: { label: 'En cours', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  EN_ATTENTE: { label: 'En attente', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  PAS_ENCORE: { label: 'Pas encore', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  SIGNALE: { label: 'Signalé', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
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
function StartModal({ project, techSons, onClose, onStart, isAdmin }: any) {
  const [selectedTechSon, setSelectedTechSon] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (techSons && techSons.length === 1 && !isAdmin) {
      setSelectedTechSon(techSons[0].id)
    }
  }, [techSons, isAdmin])

  useEffect(() => {
    if (project) {
      setSelectedTechSon('')
      setComment('')
      setSaving(false)
    }
  }, [project])

  if (!project) return null

  const handleStart = async () => {
    if (isAdmin && !selectedTechSon) {
      toast.error('Veuillez sélectionner un tech son')
      return
    }
    
    const techSonIdToUse = isAdmin ? selectedTechSon : 'self'
    
    setSaving(true)
    await onStart(project.id, techSonIdToUse, comment)
    setSaving(false)
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
            <div className="flex justify-between"><span className="text-slate-500">Projet:</span><span className="font-medium">{project.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Durée:</span><span className="font-medium">{project.durationMin ? Math.round(project.durationMin) : 0} min</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rédacteur:</span><span className="font-medium">{project.User?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Échéance:</span><span className="font-medium">{displayDateLocal(project.deadline)}</span></div>
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Users className="w-4 h-4" />Assigner à *
              </Label>
              <Select value={selectedTechSon} onValueChange={setSelectedTechSon}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Sélectionner un tech son" /></SelectTrigger>
                <SelectContent>
                  {techSons && techSons.length > 0 ? (
                    techSons.map((ts: any) => <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>)
                  ) : (
                    <SelectItem value="" disabled>Aucun tech son disponible</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} className="h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleStart} disabled={saving || (isAdmin && !selectedTechSon)}>
            {saving ? '...' : 'Commencer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal Compléter
function CompleteModal({ project, onClose, onComplete }: any) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) { setComment(''); setSaving(false) }
  }, [project])

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

// ✅ CORRECTION: Modal Modifier (Admin, Livreur, Narrateur)
// ─── Modal Modifier (Admin, Livreur, Narrateur) ──────────────────
function EditModal({ project, techSons, onClose, onEdit, canEdit }: any) {
  const [mixStatus, setMixStatus] = useState(project?.mixStatus || 'PAS_ENCORE')
  const [mixedAt, setMixedAt] = useState(project?.mixedAt?.split('T')[0] || '')
  const [techSonId, setTechSonId] = useState(project?.techSonId || 'none')
  const [comment, setComment] = useState(project?.comment || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) {
      setMixStatus(project.mixStatus || 'PAS_ENCORE')
      // ✅ CORRECTION: Gérer la date correctement
      setMixedAt(project.mixedAt ? project.mixedAt.split('T')[0] : '')
      setTechSonId(project.techSonId || 'none')
      setComment(project.comment || '')
      setSaving(false)
    }
  }, [project])

  if (!project || !canEdit) return null

  const handleEdit = async () => {
    setSaving(true)
    
    // ✅ CORRECTION: Convertir '' en null pour la date
    await onEdit(project.id, { 
      mixStatus, 
      mixedAt: mixedAt ? new Date(mixedAt).toISOString() : null,  // ✅ '' devient null
      techSonId: techSonId === 'none' ? null : techSonId, 
      comment 
    })
    setSaving(false)
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-amber-600" />
            Modifier le projet
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Projet:</span><span className="font-medium">{project.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rédacteur:</span><span className="font-medium">{project.User?.name || '-'}</span></div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Statut mixage</Label>
            <Select value={mixStatus} onValueChange={setMixStatus}>
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
            <Label>Date de mixage</Label>
            <Input 
              type="date" 
              value={mixedAt} 
              onChange={e => setMixedAt(e.target.value)} 
              // ✅ CORRECTION: Permettre de vider le champ
              placeholder="YYYY-MM-DD"
            />
            {mixedAt && (
              <button 
                type="button"
                onClick={() => setMixedAt('')}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                ✕ Effacer la date
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tech Son</Label>
            <Select value={techSonId} onValueChange={setTechSonId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un tech son" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {techSons && techSons.length > 0 ? (
                  techSons.map((ts: any) => <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>)
                ) : (
                  <SelectItem value="none" disabled>Aucun tech son disponible</SelectItem>
                )}
              </SelectContent>
            </Select>
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

export default function StudioPage() {
  const {  data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [techSonFilter, setTechSonFilter] = useState<string>('all')
  const [mixedAtFilter, setMixedAtFilter] = useState<string>('')
  const [deadlineFilter, setDeadlineFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [search, setSearch] = useState('')
  const [techSons, setTechSons] = useState<TechSon[]>([])
  const [viewingProject, setViewingProject] = useState<Project | null>(null)
  const [startingProject, setStartingProject] = useState<Project | null>(null)
  const [completingProject, setCompletingProject] = useState<Project | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)  // ✅ CORRECTION

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'
  const userJobRole = (user as any)?.jobRole
  // ✅ CORRECTION: Admin, Livreur, Narrateur peuvent modifier
  const canEdit = isAdmin || userJobRole === 'LIVREUR' || userJobRole === 'NARRATEUR'

  // Debug
  useEffect(() => {
    console.log('🔍 [STUDIO] State:', { status, user: user?.name, userJobRole, isAdmin, canEdit, projectsCount: projects.length, techSonsCount: techSons.length })
  }, [status, user, userJobRole, isAdmin, canEdit, projects.length, techSons.length])

  // Charger les Tech Sons
  useEffect(() => {
    console.log('🔍 [STUDIO] Loading tech sons...')
    fetch('/api/users?jobRole=TECH_SON')
      .then(res => {
        console.log('📡 [STUDIO] Tech sons response status:', res.status)
        return res.json()
      })
      .then(data => {
        console.log('📦 [STUDIO] Tech sons ', data)
        if (Array.isArray(data)) {
          setTechSons(data)
        } else {
          setTechSons([])
        }
      })
      .catch(err => {
        console.error('❌ [STUDIO] Error loading tech sons:', err)
        setTechSons([])
      })
  }, [])

  // Charger les projets
  useEffect(() => {
    if (!user || status !== 'authenticated') {
      console.log(' [STUDIO] Waiting for user authentication...', { user, status })
      return
    }

    console.log('🔍 [STUDIO] Fetching projects...')
    setLoading(true)
    
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
    
    fetch(`/api/projects/studio?${params.toString()}`)
      .then(res => {
        console.log('📡 [STUDIO] Projects response status:', res.status)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        console.log('📦 [STUDIO] Projects ', { count: data.projects?.length, stats: data.stats })
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
      })
      .catch(err => {
        console.error('❌ [STUDIO] Error:', err)
        toast.error('Erreur chargement projets')
        setProjects([])
        setStats({ total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user, status, statusFilter])

  // Handlers
  const handleAction = async (project: Project, action: string, techSonId?: string) => {
    console.log('🔍 [STUDIO] handleAction:', { action, projectId: project.id, techSonId })
    
    if (action === 'commencer') {
      console.log('🎯 [STUDIO] Opening StartModal for project:', project.name)
      setStartingProject(project)
      return
    }
    
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, action, techSonId, comment: project.comment })
      })
      if (res.ok) {
        toast.success('Action réussie')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/studio?${params.toString()}`)
        const data = await res2.json()
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
        setLoading(false)
      } else {
        toast.error('Erreur action')
      }
    } catch { toast.error('Erreur connexion') }
  }

  const handleStart = async (projectId: string, techSonId: string, comment: string) => {
    console.log('🔍 [STUDIO] handleStart:', { projectId, techSonId, comment })
    
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          action: 'commencer', 
          techSonId: techSonId === 'self' ? undefined : techSonId, 
          comment 
        })
      })
      
      console.log('📡 [STUDIO] Start response status:', res.status)
      
      if (res.ok) {
        toast.success('Projet commencé')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/studio?${params.toString()}`)
        const data = await res2.json()
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
        setLoading(false)
        setStartingProject(null)
      } else {
        const errorData = await res.json()
        console.error('❌ [STUDIO] Start error:', errorData)
        toast.error('Erreur: ' + (errorData.error || 'Démarrage échoué'))
      }
    } catch (err: any) {
      console.error('❌ [STUDIO] Start exception:', err)
      toast.error('Erreur connexion: ' + err.message)
    }
  }

  const handleComplete = async (projectId: string, comment: string) => {
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'fait', comment })
      })
      if (res.ok) {
        toast.success('Projet complété')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/studio?${params.toString()}`)
        const data = await res2.json()
        setProjects(data.projects || [])
        setStats(data.stats || { total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
        setLoading(false)
        setCompletingProject(null)
      } else { toast.error('Erreur complétion') }
    } catch { toast.error('Erreur connexion') }
  }

  // ✅ CORRECTION: Handler pour modifier un projet (Admin, Livreur, Narrateur)
  const handleEdit = async (projectId: string, data: any) => {
    console.log('🔧 [STUDIO] handleEdit:', { projectId, data })
    
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          action: 'update',
          mixStatus: data.mixStatus,
          mixedAt: data.mixedAt ? new Date(data.mixedAt).toISOString() : null,
          techSonId: data.techSonId || null,
          comment: data.comment
        })
      })
      if (res.ok) {
        toast.success('Projet modifié')
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
        const res2 = await fetch(`/api/projects/studio?${params.toString()}`)
        const data2 = await res2.json()
        setProjects(data2.projects || [])
        setStats(data2.stats || { total: 0, pas_encore: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
        setLoading(false)
        setEditingProject(null)
      } else { 
        const errorData = await res.json()
        toast.error('Erreur: ' + (errorData.error || 'Modification échouée'))
      }
    } catch { toast.error('Erreur connexion') }
  }

  const handleSort = (field: SortField) => {
    setSortField(field)
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Filtrage et tri
  const filteredProjects = [...projects]
    .filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.projectCode?.toLowerCase().includes(search.toLowerCase())) return false
      if (techSonFilter !== 'all' && p.techSonId !== techSonFilter) return false
      if (mixedAtFilter && (!p.mixedAt || !p.mixedAt.startsWith(mixedAtFilter))) return false
      if (deadlineFilter && (!p.deadline || !p.deadline.startsWith(deadlineFilter))) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'deadline': cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime(); break
        case 'mixedAt': cmp = new Date(a.mixedAt || 0).getTime() - new Date(b.mixedAt || 0).getTime(); break
        case 'durationMin': cmp = (a.durationMin || 0) - (b.durationMin || 0); break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

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
  if (!isAdmin && !['TECH_SON', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold">Accès réservé au studio</h2>
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
            <Package className="h-6 w-6 text-indigo-600" />Studio - Mixage
          </h1>
          <p className="text-sm text-muted-foreground">{user?.name}</p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Pas encore', value: stats.pas_encore, color: 'text-slate-600' },
            { label: 'En attente', value: stats.en_attente, color: 'text-slate-500' },
            { label: 'En cours', value: stats.en_cours, color: 'text-blue-600' },
            { label: 'Fait', value: stats.fait, color: 'text-emerald-600' },
            { label: 'Signalés', value: stats.signale, color: 'text-red-600' },
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
              <SelectItem value="EN_ATTENTE">En attente</SelectItem>
              <SelectItem value="EN_COURS">En cours</SelectItem>
              <SelectItem value="FAIT">Fait</SelectItem>
              <SelectItem value="SIGNALE">Signalés</SelectItem>
            </SelectContent>
          </Select>

          <Select value={techSonFilter} onValueChange={setTechSonFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tech Son" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {techSons.map(ts => <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input type="date" value={mixedAtFilter} onChange={e => setMixedAtFilter(e.target.value)} className="w-40 h-9" />
          <Input type="date" value={deadlineFilter} onChange={e => setDeadlineFilter(e.target.value)} className="w-40 h-9" />

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
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Tech Son</th>
                    <SortableHeader label="Date mixage" field="mixedAt" currentSort={{ field: sortField, order: sortOrder }} onSort={handleSort} />
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
                      <td className="py-2.5 px-3 whitespace-nowrap hidden md:table-cell">{p.User?.name || '-'}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap hidden md:table-cell">{p.User_1?.name || '-'}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{displayDateLocal(p.mixedAt)}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={p.mixStatus} /></td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!p.techSonId && (
                            <Button size="sm" variant="outline" className="h-7" onClick={() => handleAction(p, 'commencer')}>
                              <PlayCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {p.techSonId && p.mixStatus !== 'FAIT' && p.mixStatus !== 'SIGNALE' && (
                            <Button size="sm" variant="outline" className="h-7" onClick={() => handleAction(p, 'fait')}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => setViewingProject(p)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {/* ✅ CORRECTION: Bouton Modifier (Admin, Livreur, Narrateur) */}
                          {canEdit && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-amber-600 hover:text-amber-700" 
                              onClick={() => {
                                console.log('🎯 [STUDIO] Edit button clicked for project:', p.name)
                                setEditingProject(p)
                              }}
                            >
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
                  <div><span className="text-slate-500">Tech Son:</span> <span className="font-medium">{viewingProject.User_1?.name || '-'}</span></div>
                  <div><span className="text-slate-500">Durée:</span> <span className="font-medium">{viewingProject.durationMin ? Math.round(viewingProject.durationMin) : 0} min</span></div>
                  <div><span className="text-slate-500">Mix terminé:</span> <span className="font-medium">{displayDateLocal(viewingProject.mixedAt)}</span></div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" size="sm" onClick={() => setViewingProject(null)}>Fermer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ✅ CORRECTION: Modal Start */}
        <StartModal 
          project={startingProject} 
          techSons={techSons} 
          onClose={() => setStartingProject(null)} 
          onStart={handleStart} 
          isAdmin={isAdmin} 
        />
        
        <CompleteModal project={completingProject} onClose={() => setCompletingProject(null)} onComplete={handleComplete} />
        
        {/* ✅ CORRECTION: Modal Edit */}
        {editingProject && (
          <EditModal 
            project={editingProject} 
            techSons={techSons} 
            onClose={() => setEditingProject(null)} 
            onEdit={handleEdit}
            canEdit={canEdit}
          />
        )}
      </div>
    </DashboardLayout>
  )
}