'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Package, CheckCircle2, AlertCircle, Clock, Calendar,
  ArrowUp, ArrowDown, RefreshCw, Search, TrendingUp,
  BarChart3, MessageSquare
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
  startDate: string | null
  durationMin: number | null
  pageCount: number | null
  status: string | null
  mixStatus: string | null
  workflowStep: string | null
  deliveryStatus: string | null  // ✅ NOUVEAU: CONFORME / NON_CONFORME
  redacteurId: string | null
  techSonId: string | null
  createdAt: string
  comment: string | null
  writtenAt: string | null
  mixedAt: string | null
  deliveredAt: string | null
  redactionReturns: number | null  // ✅ NOUVEAU
  mixageReturns: number | null      // ✅ NOUVEAU
  User: { id: string; name: string } | null
  User_1: { id: string; name: string } | null
}

interface Stats {
  total: number
  aLivr: number
  livres: number
  conformes: number
  retours: number
}

type FilterType = 'all' | 'conforme' | 'aLivr' | 'retours'
type SortField = 'deadline' | 'mixedAt' | 'name' | 'durationMin'
type SortOrder = 'asc' | 'desc'

function displayDateLocal(dateString: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function displayDateTime(dateString: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { 
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
  })
}

// ─── Modal Signaler ────────────────────────────────────────
function SignalerModal({ project, onClose, onSignaler }: {
  project: Project | null
  onClose: () => void
  onSignaler: (projectId: string, comment: string, returnType: 'redaction' | 'mixage') => Promise<void>
}) {
  const [comment, setComment] = useState('')
  const [returnType, setReturnType] = useState<'redaction' | 'mixage'>('mixage')
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const handleSignaler = async () => {
    if (!comment.trim()) {
      toast.error('Veuillez ajouter un commentaire')
      return
    }
    setSaving(true)
    await onSignaler(project.id, comment, returnType)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Signaler un problème
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Projet:</span>
              <span className="font-medium">{project.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rédacteur:</span>
              <span className="font-medium">{project.User?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tech Son:</span>
              <span className="font-medium">{project.User_1?.name || '-'}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Retourner à *</Label>
            <select
              value={returnType}
              onChange={e => setReturnType(e.target.value as 'redaction' | 'mixage')}
              className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm"
            >
              <option value="mixage">Studio (Mixage)</option>
              <option value="redaction">Rédaction</option>
            </select>
            <p className="text-xs text-slate-500">
              {returnType === 'mixage' 
                ? 'Le projet retournera au tech son pour correction'
                : 'Le projet retournera au rédacteur pour correction'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Commentaire *</Label>
            <Textarea
              placeholder="Décrivez le problème détecté..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="h-24 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSignaler} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {saving ? 'Envoi...' : 'Signaler'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Ligne Projet ──────────────────────────────────────────
function ProjectRow({ project, onConforme, onSignaler, onLivrer }: {
  project: Project
  onConforme: (id: string) => void
  onSignaler: (p: Project) => void
  onLivrer: (id: string) => void
}) {
  const daysLeft = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isLate = daysLeft < 0 && !project.deliveredAt
  const isSoon = daysLeft >= 0 && daysLeft <= 7 && !project.deliveredAt

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

      <td className="py-2.5 px-3">
        <span className={`text-xs font-medium flex items-center gap-1 ${
          isLate ? 'text-red-600' : isSoon ? 'text-orange-500' : 'text-slate-600'
        }`}>
          {(isLate || isSoon) && <AlertCircle className="w-3 h-3" />}
          {displayDateLocal(project.deadline)}
        </span>
        {isLate && <div className="text-xs text-red-500">{Math.abs(daysLeft)}j retard</div>}
      </td>

      <td className="py-2.5 px-3 hidden md:table-cell">
        <div className="text-sm font-semibold text-indigo-600">
          {project.durationMin ? `${Math.round(project.durationMin)} min` : '—'}
        </div>
      </td>

      <td className="py-2.5 px-3 hidden lg:table-cell">
        <div className="text-xs text-slate-600">{displayDateLocal(project.writtenAt)}</div>
      </td>

      <td className="py-2.5 px-3 hidden lg:table-cell">
        <div className="text-xs text-slate-600">{displayDateLocal(project.mixedAt)}</div>
      </td>

      <td className="py-2.5 px-3 hidden xl:table-cell">
        <div className="text-xs text-slate-600">{project.User?.name || '—'}</div>
      </td>

      <td className="py-2.5 px-3 hidden xl:table-cell">
        <div className="text-xs text-slate-600">{project.User_1?.name || '—'}</div>
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell">
        {project.deliveredAt ? (
          <Badge className="bg-emerald-100 text-emerald-700 text-xs">FAIT</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600 text-xs">PAS ENCORE</Badge>
        )}
      </td>

      <td className="py-2.5 px-3 hidden md:table-cell">
        <div className="text-xs text-slate-600">{displayDateLocal(project.deliveredAt)}</div>
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        <span className={`text-xs font-semibold ${
          (project.redactionReturns || 0) > 0 ? 'text-red-600' : 'text-slate-400'
        }`}>
          {project.redactionReturns || 0}
        </span>
      </td>

      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        <span className={`text-xs font-semibold ${
          (project.mixageReturns || 0) > 0 ? 'text-amber-600' : 'text-slate-400'
        }`}>
          {project.mixageReturns || 0}
        </span>
      </td>

      <td className="py-2.5 px-3">
        <div className="flex items-center justify-end gap-1">
          {!project.deliveredAt && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => onConforme(project.id)}
                title="Marquer comme conforme"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => onSignaler(project)}
                title="Signaler un problème"
              >
                <AlertCircle className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                onClick={() => onLivrer(project.id)}
                title="Marquer comme livré"
              >
                <Package className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {project.deliveredAt && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ Livré</Badge>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Page Principale ───────────────────────────────────────
export default function LivraisonPage() {
  const {  data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0, aLivr: 0, livres: 0, conformes: 0, retours: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [signalerProject, setSignalerProject] = useState<Project | null>(null)

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const userJobRole = (user as any)?.jobRole
  const isAdmin = user?.role === 'ADMIN'
  const isLivreur = userJobRole === 'LIVREUR'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin && !isLivreur) {
      router.push('/dashboard')
    }
  }, [status, isAdmin, isLivreur])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('mixStatus', 'FAIT')  // ✅ Uniquement projets mixage terminé
      
      const res = await fetch(`/api/projects/livraison?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      
      setProjects(data.projects || [])
      
      // Calculer stats
      const projectsList = data.projects || []
      const calculatedStats: Stats = {
        total: projectsList.length,
        aLivr: projectsList.filter((p: any) => !p.deliveredAt).length,
        livres: projectsList.filter((p: any) => p.deliveredAt).length,
        conformes: projectsList.filter((p: any) => p.deliveryStatus === 'CONFORME').length,
        retours: projectsList.filter((p: any) => 
          (p.redactionReturns || 0) > 0 || (p.mixageReturns || 0) > 0
        ).length,
      }
      setStats(calculatedStats)
    } catch (e) {
      console.error('Erreur chargement:', e)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  // ✅ Action: Marquer comme conforme
  const handleConforme = async (projectId: string) => {
    try {
      const res = await fetch('/api/projects/livraison', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          action: 'conforme',
          deliveryStatus: 'CONFORME'
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Projet marqué comme conforme')
      fetchData()
    } catch {
      toast.error('Erreur mise à jour')
    }
  }

  // ✅ Action: Signaler problème
  const handleSignaler = async (projectId: string, comment: string, returnType: 'redaction' | 'mixage') => {
    try {
      const res = await fetch('/api/projects/livraison', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          action: 'signaler',
          comment,
          returnType  // 'redaction' ou 'mixage'
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Projet signalé et retourné')
      fetchData()
    } catch {
      toast.error('Erreur signalement')
    }
  }

  // ✅ Action: Livrer projet
  const handleLivrer = async (projectId: string) => {
    try {
      const res = await fetch('/api/projects/livraison', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          action: 'livrer',
          deliveredAt: new Date().toISOString()
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Projet livré')
      fetchData()
    } catch {
      toast.error('Erreur livraison')
    }
  }

  // Filtrage et tri
  const filtered = projects
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name?.toLowerCase().includes(q) ||
        p.seriesName?.toLowerCase().includes(q) ||
        p.projectCode?.toLowerCase().includes(q)
    })
    .filter(p => {
      if (filter === 'all') return true
      if (filter === 'conforme') return p.deliveryStatus === 'CONFORME'
      if (filter === 'aLivr') return !p.deliveredAt
      if (filter === 'retours') return (p.redactionReturns || 0) > 0 || (p.mixageReturns || 0) > 0
      return true
    })
    .sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'deadline': aVal = a.deadline; bVal = b.deadline; break
        case 'mixedAt': aVal = a.mixedAt; bVal = b.mixedAt; break
        case 'name': aVal = a.name; bVal = b.name; break
        case 'durationMin': aVal = a.durationMin || 0; bVal = b.durationMin || 0; break
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
              Livraison & Qualité
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestion de la livraison et contrôle qualité
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> À livrer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.aLivr}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Livrés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.livres}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Conformes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-600">{stats.conformes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Retours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.retours}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher (nom, série, code...)" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-10" 
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as FilterType)}
            className="h-10 px-3 rounded-md border border-slate-300 text-sm"
          >
            <option value="all">Tous</option>
            <option value="conforme">Conformes</option>
            <option value="aLivr">À livrer</option>
            <option value="retours">Avec retours</option>
          </select>
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            className="h-10 px-3 rounded-md border border-slate-300 text-sm"
          >
            <option value="deadline">Échéance</option>
            <option value="mixedAt">Date mixage</option>
            <option value="name">Nom</option>
            <option value="durationMin">Durée</option>
          </select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-10 w-10 p-0"
          >
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
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500">Échéance</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Durée</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date rédaction</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date mixage</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden xl:table-cell">Rédacteur</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden xl:table-cell">Tech Son</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Statut livraison</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Date livraison</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Ret. Rédac</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Ret. Mixage</th>
                  <th className="py-3 px-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center">
                      <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">Aucun projet trouvé</p>
                      <p className="text-slate-400 text-sm mt-1">Les projets apparaissent ici après validation du mixage</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      onConforme={handleConforme}
                      onSignaler={setSignalerProject}
                      onLivrer={handleLivrer}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Signaler */}
        {signalerProject && (
          <SignalerModal
            project={signalerProject}
            onClose={() => setSignalerProject(null)}
            onSignaler={handleSignaler}
          />
        )}
      </div>
    </DashboardLayout>
  )
}