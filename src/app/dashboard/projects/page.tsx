// src/app/dashboard/projects/page.tsx
'use client'
// ✅ AJOUTER ces imports
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Package, Search, AlertTriangle, CheckCircle, Clock, TrendingUp,
  FileText, X, Filter, Download, ArrowRight
} from 'lucide-react'

interface Stats {
  totalProjects: number
  receivedThisPeriod: number
  deliveredThisPeriod: number
  inProgress: number
  totalMinutesReceived: number
  totalMinutesDelivered: number
  period: { startDate: string; endDate: string }
}

interface Alert {
  id: string
  name: string
  deadline?: string
  status?: string
  type: 'RETARD' | 'ECHEANCE_7J' | 'RETOUR_QC'
}

interface SearchResult {
  id: string
  name: string
  seriesName: string
  workflowStep: string
  deadline: string
  durationMin: number | null
}

export default function ProjectsDashboard() {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [alerts, setAlerts] = useState<{ retard: Alert[]; echeanceProche: Alert[]; retourQC: Alert[] }>({ retard: [], echeanceProche: [], retourQC: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [period, setPeriod] = useState('month')

  const user = sessionData?.user as any
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, isAdmin])

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ period })
      const res = await fetch(`/api/projects/dashboard?${params.toString()}`)
      const data = await res.json()
      setStats(data.stats)
      setAlerts(data.alerts)
    } catch {
      toast.error('Erreur de chargement du dashboard')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { if (user) fetchDashboard() }, [user, fetchDashboard])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Entrez un terme de recherche')
      return
    }
    try {
      const res = await fetch(`/api/projects/dashboard?q=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json()
      setSearchResults(data.searchResults || [])
      setShowSearchModal(true)
    } catch {
      toast.error('Erreur lors de la recherche')
    }
  }

  const getStepColor = (step: string) => {
    const colors: Record<string, string> = {
      DISPATCH: 'bg-slate-100 text-slate-700',
      REDACTION: 'bg-blue-100 text-blue-700',
      STUDIO: 'bg-purple-100 text-purple-700',
      LIVRAISON: 'bg-orange-100 text-orange-700',
      LIVRE: 'bg-emerald-100 text-emerald-700'
    }
    return colors[step] || 'bg-slate-100 text-slate-700'
  }

  if (loading) {
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
              Dashboard Projets VD
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Vue globale • Période: {stats?.period.startDate} → {stats?.period.endDate}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/dispatch')} className="gap-2">
              <Package className="w-4 h-4" />Dispatch
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />Export
            </Button>
          </div>
        </div>

        {/* Barre de recherche + Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher un projet (nom, série, chaîne, code...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-9 h-10"
            />
          </div>
          <Button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Search className="w-4 h-4" />Rechercher
          </Button>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Package className="w-4 h-4" />Projets reçus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.receivedThisPeriod || 0}</p>
              <p className="text-xs text-slate-400 mt-1">{stats?.totalMinutesReceived || 0} minutes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />Projets livrés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{stats?.deliveredThisPeriod || 0}</p>
              <p className="text-xs text-slate-400 mt-1">{stats?.totalMinutesDelivered || 0} minutes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />En production
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{stats?.inProgress || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Rédaction + Studio + Livraison</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />Total projets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-indigo-600">{stats?.totalProjects || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Toutes étapes confondues</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertes */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />Retards ({alerts.retard.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.retard.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun retard</p>
              ) : (
                <div className="space-y-2">
                  {alerts.retard.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{a.name}</span>
                      <Badge variant="destructive" className="text-[10px]">{a.deadline}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />Échéances &lt; 7j ({alerts.echeanceProche.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.echeanceProche.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune échéance proche</p>
              ) : (
                <div className="space-y-2">
                  {alerts.echeanceProche.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{a.name}</span>
                      <Badge className="bg-orange-100 text-orange-700 text-[10px]">{a.deadline}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
                <X className="w-4 h-4" />Retours QC ({alerts.retourQC.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.retourQC.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun retour QC</p>
              ) : (
                <div className="space-y-2">
                  {alerts.retourQC.slice(0, 5).map(a => (
                    <div key={a.id} className="text-xs">
                      <span className="font-medium truncate block">{a.name}</span>
                      <span className="text-slate-400">{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recherche Modal */}
        <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-500" />
                Résultats pour "{searchQuery}"
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun projet trouvé</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-medium text-slate-500">Projet</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-500">Échéance</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-500">Étape</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-500">Durée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-slate-400 text-[10px] truncate max-w-[180px]">{p.name}</span>
                              <span className="font-medium text-slate-800">{p.seriesName}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {new Date(p.deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={`${getStepColor(p.workflowStep)} text-xs border-0`}>{p.workflowStep}</Badge>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{p.durationMin ? `${p.durationMin} min` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500 border-t">
                    {searchResults.length} résultat(s)
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowSearchModal(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}