'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlayCircle, CheckCircle2, AlertTriangle, Eye, Package, AlertCircle, Save } from 'lucide-react'

interface Project {
  id: string
  name: string
  seriesName: string
  pageCount: number
  durationMin: number
  workflowStep: string
  mixStatus: string
  comment: string
  redacteurId: string
  techSonId: string
  createdAt: string
  mixStartedAt: string
  mixDoneAt: string
  User: { id: string; name: string }
  User_1: { id: string; name: string } | null
}

interface Stats {
  total: number
  en_attente: number
  en_cours: number
  fait: number
  signale: number
}

export default function StudioDashboard() {
  const {   data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, en_attente: 0, en_cours: 0, fait: 0, signale: 0 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [techSonFilter, setTechSonFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [comment, setComment] = useState('')

  const user = session?.user as any
  const userJobRole = user?.jobRole

  useEffect(() => {
    console.log('🔍 [STUDIO] User:', user?.name, 'JobRole:', userJobRole, 'Status:', status)
    if (status === 'unauthenticated') router.push('/login')
  }, [status, user, router])

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (techSonFilter !== 'all') params.set('techSonId', techSonFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/projects/studio?${params.toString()}`)
      const data = await res.json()
      setProjects(data.projects || [])
      setStats(data.stats || {})
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, techSonFilter, dateFrom, dateTo])

  useEffect(() => {
    if (status === 'authenticated' && user) fetchProjects()
  }, [status, user, fetchProjects])

  const handleAction = async (projectId: string, action: string) => {
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action, comment })
      })
      if (res.ok) {
        toast.success(`Action "${action}" effectuée`)
        fetchProjects()
        if (action !== 'saveComment') {
          setShowDetails(false)
          setComment('')
        }
      } else {
        toast.error('Erreur lors de l\'action')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const handleSaveComment = async (projectId: string) => {
    try {
      const res = await fetch('/api/projects/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'saveComment', comment })
      })
      if (res.ok) {
        toast.success('Commentaire enregistré')
        if (selectedProject) {
          setSelectedProject({ ...selectedProject, comment })
        }
      } else {
        toast.error('Erreur d\'enregistrement')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const getStatusBadge = (projStatus: string) => {
    switch (projStatus) {
      case 'EN_COURS': return <Badge className="bg-blue-100 text-blue-700">En cours</Badge>
      case 'FAIT': return <Badge className="bg-emerald-100 text-emerald-700">Fait</Badge>
      case 'SIGNALE': return <Badge className="bg-red-100 text-red-700">Signalé</Badge>
      default: return <Badge variant="outline">En attente</Badge>
    }
  }

  if (status === 'loading') {
    return <DashboardLayout><div className="min-h-[60vh] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" /></div></DashboardLayout>
  }

  if (!user || !['TECH_SON', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
    return <DashboardLayout><div className="min-h-[60vh] flex items-center justify-center text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">Accès réservé au studio</h2><p className="text-slate-500 mb-4">Ton rôle : <strong>{userJobRole || 'Aucun'}</strong></p><Button onClick={() => router.push('/dashboard')} className="mt-4">Retour</Button></div></DashboardLayout>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            Studio - Mixage
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestion des projets en mixage • {user?.name} ({userJobRole})</p>
        </div>

        {/* STATS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">En attente</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-slate-600">{stats.en_attente}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">En cours</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{stats.en_cours}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Fait</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{stats.fait}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Signalés</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{stats.signale}</p></CardContent></Card>
        </div>

        {/* FILTRES */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="en_attente">En attente</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="fait">Fait</SelectItem>
              <SelectItem value="signale">Signalés</SelectItem>
            </SelectContent>
          </Select>
          <Select value={techSonFilter} onValueChange={setTechSonFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tech Son" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tous</SelectItem></SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
          <Button onClick={fetchProjects} size="sm" disabled={loading}>{loading ? '...' : 'Filtrer'}</Button>
        </div>

        {/* TABLEAU */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Projet</th>
                <th className="text-left py-3 px-4 font-medium">Date</th>
                <th className="text-center py-3 px-4 font-medium">Pages</th>
                <th className="text-left py-3 px-4 font-medium">Rédacteur</th>
                <th className="text-center py-3 px-4 font-medium">Tech Son</th>
                <th className="text-center py-3 px-4 font-medium">Statut</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id} className="border-t hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium truncate max-w-[200px]" title={project.name}>{project.name}</td>
                  <td className="py-3 px-4">{project.createdAt ? new Date(project.createdAt).toLocaleDateString('fr-FR') : '-'}</td>
                  <td className="py-3 px-4 text-center">{project.pageCount || '-'}</td>
                  <td className="py-3 px-4">{project.User?.name || '-'}</td>
                  <td className="py-3 px-4 text-center">{project.User_1?.name || <span className="text-slate-400">-</span>}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(project.mixStatus)}</td>
                  <td className="py-3 px-4 text-right space-x-1">
                    {/* ✅ CORRECTION: Boutons côte à côte */}
                    {!project.techSonId && (
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => handleAction(project.id, 'commencer')} title="Commencer">
                        <PlayCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setSelectedProject(project); setShowDetails(true); setComment(project.comment || '') }} title="Voir détails">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && !loading && <tr><td colSpan={7} className="py-8 text-center text-slate-400">Aucun projet trouvé</td></tr>}
            </tbody>
          </table>
        </div>

        {/* MODAL DETAILS */}
        {showDetails && selectedProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6">
              <h2 className="text-xl font-bold mb-4">Détails du projet</h2>
              
              <div className="space-y-3 mb-6">
                {/* ✅ CORRECTION: ID affiché ici, pas dans le tableau */}
                <div className="flex justify-between">
                  <span className="text-slate-500">ID:</span>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{selectedProject.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nom:</span>
                  <span className="font-medium">{selectedProject.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Série:</span>
                  <span className="font-medium">{selectedProject.seriesName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pages:</span>
                  <span className="font-medium">{selectedProject.pageCount || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Durée:</span>
                  <span className="font-medium">{selectedProject.durationMin || 0} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rédacteur:</span>
                  <span className="font-medium">{selectedProject.User?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tech Son:</span>
                  <span className="font-medium">{selectedProject.User_1?.name || 'Non assigné'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Statut:</span>
                  {getStatusBadge(selectedProject.mixStatus)}
                </div>
                {selectedProject.mixStartedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Début mix:</span>
                    <span className="font-medium">{new Date(selectedProject.mixStartedAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {selectedProject.mixDoneAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mix terminé:</span>
                    <span className="font-medium">{new Date(selectedProject.mixDoneAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
              </div>

              {/* ✅ CORRECTION: Commentaire avec sauvegarde */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Commentaire / Signalement</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                  rows={3}
                  placeholder="Ajouter un commentaire..."
                />
                <Button size="sm" variant="outline" className="mt-2" onClick={() => handleSaveComment(selectedProject.id)}>
                  <Save className="w-4 h-4 mr-2" /> Enregistrer le commentaire
                </Button>
              </div>

              {/* ✅ CORRECTION: Boutons d'action */}
              <div className="flex gap-2 justify-end">
                {!selectedProject.techSonId && (
                  <Button onClick={() => handleAction(selectedProject.id, 'commencer')} className="bg-blue-600 hover:bg-blue-700">
                    <PlayCircle className="w-4 h-4 mr-2" /> Commencer
                  </Button>
                )}
                {selectedProject.techSonId && selectedProject.mixStatus !== 'FAIT' && selectedProject.mixStatus !== 'SIGNALE' && (
                  <>
                    <Button onClick={() => handleAction(selectedProject.id, 'fait')} className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Fait
                    </Button>
                    <Button onClick={() => handleAction(selectedProject.id, 'signaler')} variant="destructive">
                      <AlertTriangle className="w-4 h-4 mr-2" /> Signaler
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setShowDetails(false)}>Fermer</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}