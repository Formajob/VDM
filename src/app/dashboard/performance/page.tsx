'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp, AlertTriangle, Activity, Clock, Target, Filter, Calendar, Download, Trophy, Users
} from 'lucide-react'

interface Alert {
  type: string
  message: string
  severity: string
}

interface PerformanceData {
  userId: string
  name: string
  jobRole: string
  projectCount: number
  totalMinutes: number
  objectif: number
  ecart: number
  moyenneJour: number
  rang: number
}

interface DailyData {
  date: string
  label: string
  byMember: Record<string, { minutes: number; count: number }>
}

interface StatsByTeam {
  redaction: { members: number; minutes: number; objectif: number }
  mixage: { members: number; minutes: number; objectif: number }
}

export default function PerformanceDashboard() {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [period, setPeriod] = useState('week')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [team, setTeam] = useState('all')
  const [selectedMember, setSelectedMember] = useState('all')
  const [performance, setPerformance] = useState<PerformanceData[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [stats, setStats] = useState({ totalProjects: 0, totalMinutes: 0, moyenneJour: 0, memberCount: 0 })
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [teamStats, setTeamStats] = useState({ totalMinutes: 0, objectif: 0, pourcentage: 0 })
  const [statsByTeam, setStatsByTeam] = useState<StatsByTeam>({
    redaction: { members: 0, minutes: 0, objectif: 0 },
    mixage: { members: 0, minutes: 0, objectif: 0 }
  })
  const [allMembers, setAllMembers] = useState<Array<{ id: string; name: string; jobRole: string }>>([])

  const user = sessionData?.user as any
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, isAdmin])

  // ✅ Charger les membres par équipe
  const fetchMembers = useCallback(async (selectedTeam: string) => {
    try {
      setLoadingMembers(true)
      const res = await fetch(`/api/users/all?team=${selectedTeam}`)
      if (res.ok) {
        const data = await res.json()
        setAllMembers(data.users || [])
      }
    } catch (err) {
      console.error('Erreur chargement membres:', err)
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  const fetchPerformance = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ period, team })
      if (period === 'custom' && dateFrom && dateTo) {
        params.set('dateFrom', dateFrom)
        params.set('dateTo', dateTo)
      }
      if (selectedMember !== 'all') {
        params.set('memberIds', selectedMember)
      }
      const res = await fetch(`/api/projects/performance?${params.toString()}`)
      const data = await res.json()
      setPerformance(data.performanceByMember || [])
      setDailyData(data.dailyPerformance || [])
      setStats(data.stats || {})
      setTeamStats(data.teamStats || {})
      setStatsByTeam(data.statsByTeam || { redaction: {}, mixage: {} })
      setAlerts(data.alerts || [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [period, dateFrom, dateTo, team, selectedMember])

  useEffect(() => {
    if (user) {
      fetchPerformance()
      fetchMembers(team)
    }
  }, [user, team, fetchPerformance, fetchMembers])

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-100'
    if (minutes < 100) return 'bg-red-200'
    if (minutes < 200) return 'bg-orange-200'
    return 'bg-emerald-200'
  }

  const generateReport = () => {
    const periodLabel = period === 'today' ? "Aujourd'hui" : period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : 'Personnalisé'
    const reportContent = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Rapport Performance</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;background:#f8fafc}
        .header{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:30px;border-radius:12px;text-align:center;margin-bottom:20px}
        .header h1{margin:0;font-size:24px}.platform{opacity:0.9;font-size:14px;margin-top:8px}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:20px}
        .stat{background:white;padding:15px;border-radius:8px;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
        .stat-value{font-size:24px;font-weight:bold;color:#4f46e5}.stat-label{font-size:12px;color:#64748b}
        table{width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden}
        th{background:#f1f5f9;padding:12px;text-align:left;font-size:12px;color:#64748b}
        td{padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px}
        .footer{margin-top:30px;padding:20px;text-align:center;background:#1e293b;color:white;border-radius:8px}
        .footer a{color:#4f46e5;text-decoration:none;font-weight:bold}
      </style></head><body>
      <div class="header"><h1>📊 Rapport Performance</h1><div class="platform">🎬 Plateforme VDM by Formajob</div></div>
      <p><strong>Période:</strong> ${periodLabel} | <strong>Équipe:</strong> ${team === 'redaction' ? 'Rédaction' : team === 'mixage' ? 'Mixage' : 'Toutes'}</p>
      <div class="stats">
        <div class="stat"><div class="stat-label">Projets</div><div class="stat-value">${stats.totalProjects}</div></div>
        <div class="stat"><div class="stat-label">Minutes</div><div class="stat-value">${stats.totalMinutes}</div></div>
        <div class="stat"><div class="stat-label">Moyenne/jour</div><div class="stat-value">${stats.moyenneJour} min</div></div>
        <div class="stat"><div class="stat-label">Performance</div><div class="stat-value">${teamStats.pourcentage}%</div></div>
      </div>
      <table><thead><tr><th>Rang</th><th>Membre</th><th>Projets</th><th>Minutes</th><th>Objectif</th><th>Écart</th></tr></thead><tbody>
      ${performance.map(m => `<tr><td>${m.rang}</td><td>${m.name}</td><td>${m.projectCount}</td><td>${m.totalMinutes}</td><td>${m.objectif}</td><td style="color:${m.ecart>=0?'#16a34a':'#dc2626'}">${m.ecart>=0?'+':''}${m.ecart}</td></tr>`).join('')}
      </tbody></table>
      <div class="footer"><a href="https://Formajob.ma">🌐 Formajob.ma</a><br><small>© ${new Date().getFullYear()} VDM Platform</small></div>
      </body></html>`
    const blob = new Blob([reportContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-${period}-${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Rapport généré')
  }

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

        {/* ───────────────────────────────────────────────
            1. HEADER
            ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
              Performance des Équipes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Suivi équipe • {period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : period === 'year' ? 'Cette année' : 'Personnalisé'}
            </p>
          </div>
          <Button onClick={generateReport} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Rapport
          </Button>
        </div>

        {/* ───────────────────────────────────────────────
            2. FILTRES
            ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
              <SelectItem value="year">Année</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>

         <Select value={team} onValueChange={(v) => { setTeam(v); fetchMembers(v) }}>
  <SelectTrigger className="w-40">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Toutes</SelectItem>
    <SelectItem value="redaction">Rédaction</SelectItem>
    <SelectItem value="mixage">Mixage</SelectItem>
    {/* ✅ SUPPRIMER: Narration et Livraison */}
  </SelectContent>
</Select>

          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={loadingMembers ? 'Chargement...' : 'Membre'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {allMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-2 py-2 text-sm" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-2 py-2 text-sm" />
            </>
          )}

          <Button onClick={fetchPerformance} size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtrer
          </Button>
        </div>

        {/* ───────────────────────────────────────────────
            3. STATS CARDS (4 cartes)
            ─────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Total projets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalProjects}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Minutes totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-indigo-600">{stats.totalMinutes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Moyenne/jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{stats.moyenneJour} min</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Membres
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-700">{stats.memberCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* ───────────────────────────────────────────────
            4. GRAPHIQUE PERFORMANCE vs OBJECTIF (2 cartes)
            ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Jauge circulaire */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Performance vs Objectif
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="#e2e8f0" strokeWidth="12" fill="none" />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke={teamStats.pourcentage >= 100 ? '#10b981' : teamStats.pourcentage >= 80 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 70}
                    strokeDashoffset={2 * Math.PI * 70 * (1 - Math.min(teamStats.pourcentage, 100) / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-800">{teamStats.pourcentage}%</span>
                  <span className="text-xs text-slate-500">atteint</span>
                </div>
              </div>
              <div className="mt-4 text-center space-y-1">
                <p className="text-sm text-slate-600">
  <span className="font-semibold text-indigo-600">{teamStats.totalMinutes} min</span> sur{' '}
  <span className="font-semibold text-slate-400">
    {team === 'all' 
      ? `${statsByTeam?.redaction?.objectif || 0} min (Réd.) + ${statsByTeam?.mixage?.objectif || 0} min (Mix)` 
      : teamStats.objectif
    }
  </span>
</p>
                <p className="text-xs text-slate-400">Objectif : 200 min/jour</p>
              </div>
            </CardContent>
          </Card>

          {/* Barres comparatives + Écart + Statut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Détails
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6 space-y-4">
              {/* Barre Objectif */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Objectif</span>
                  <span className="font-semibold text-slate-700">{teamStats.objectif} min</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Barre Performance */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Réalisé</span>
                  <span className="font-semibold text-indigo-600">{teamStats.totalMinutes} min</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      teamStats.pourcentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      teamStats.pourcentage >= 80 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${Math.min(teamStats.pourcentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Écart */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Écart</span>
                  <span className={`text-lg font-bold ${
                    teamStats.totalMinutes - teamStats.objectif >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {teamStats.totalMinutes - teamStats.objectif >= 0 ? '+' : ''}
                    {teamStats.totalMinutes - teamStats.objectif} min
                  </span>
                </div>
              </div>

              {/* Statut */}
              <div className={`pt-3 mt-3 text-center rounded-lg ${
                teamStats.pourcentage >= 100 ? 'bg-emerald-50' :
                teamStats.pourcentage >= 80 ? 'bg-yellow-50' :
                teamStats.pourcentage >= 50 ? 'bg-orange-50' :
                'bg-red-50'
              }`}>
                <p className={`text-sm font-semibold ${
                  teamStats.pourcentage >= 100 ? 'text-emerald-700' :
                  teamStats.pourcentage >= 80 ? 'text-yellow-700' :
                  teamStats.pourcentage >= 50 ? 'text-orange-700' :
                  'text-red-700'
                }`}>
                  {teamStats.pourcentage >= 100 ? '🎉 Objectif atteint !' :
                   teamStats.pourcentage >= 80 ? '⚠️ Presque là !' :
                   teamStats.pourcentage >= 50 ? '📈 En progression...' :
                   '🔴 Retard important'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ───────────────────────────────────────────────
            5. ALERTES
            ─────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Alertes
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`p-3 rounded border ${
                    alert.severity === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-orange-50 border-orange-200 text-orange-700'
                  }`}
                >
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────
            6. TABLEAU PERFORMANCE PAR MEMBRE (avec Nb Projets)
            ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-600">Rang</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">Membre</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Rôle</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Projets</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Minutes</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Objectif</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Écart</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Moy./jour</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(m => (
                <tr key={m.userId} className="border-t hover:bg-slate-50">
                  <td className="py-3 px-4">
                    {m.rang === 1 ? '🥇' : m.rang === 2 ? '🥈' : m.rang === 3 ? '🥉' : m.rang}
                  </td>
                  <td className="py-3 px-4 font-medium">{m.name}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="outline" className="text-xs">{m.jobRole}</Badge>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-indigo-600">{m.projectCount}</td>
                  <td className="py-3 px-4 text-center font-semibold text-indigo-600">{m.totalMinutes}</td>
                  <td className="py-3 px-4 text-center text-slate-500">{m.objectif}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className={m.ecart >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {m.ecart >= 0 ? '+' : ''}{m.ecart}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">{m.moyenneJour} min</td>
                </tr>
              ))}
              {performance.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Aucune donnée pour cette période
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ───────────────────────────────────────────────
            7. HEATMAP (Vue détaillée par jour)
            ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Vue détaillée par jour
          </h3>
          <div className="bg-white rounded-xl border overflow-x-auto p-4">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 sticky left-0 bg-white">Membre</th>
                  {dailyData.map(d => (
                    <th key={d.date} className="text-center py-2 px-2 font-medium text-slate-600">
                      {d.label}
                    </th>
                  ))}
                  <th className="text-center py-2 px-3 font-medium text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {performance.map(m => (
                  <tr key={m.userId} className="border-t">
                    <td className="py-2 px-3 font-medium sticky left-0 bg-white">{m.name}</td>
                    {dailyData.map(d => {
                      const mins = d.byMember[m.userId]?.minutes || 0
                      return (
                        <td
                          key={d.date}
                          className={`py-2 px-2 text-center ${getHeatmapColor(mins)}`}
                          title={`${mins} min`}
                        >
                          {mins > 0 ? mins : '-'}
                        </td>
                      )
                    })}
                    <td className="py-2 px-3 text-center font-semibold">{m.totalMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Légende (min/jour) :</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-100 rounded" />
              <span>0</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 rounded" />
              <span>&lt;100</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 rounded" />
              <span>100-200 (objectif)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-200 rounded" />
              <span>&gt;200</span>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}