 'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  TrendingUp, AlertTriangle, Activity, Clock, Target, Filter, Calendar, Download, Trophy, Users
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  LabelList
} from 'recharts'

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
  minutes: number
  projects: number
  byMember: Record<string, { minutes: number; count: number }>
}

interface DayOfWeekData {
  day: string
  dayShort: string
  minutes: number
}

interface DailyTrendData {
  date: string
  label: string
  minutes: number
  objectif: number
}

type PeriodType = 'day' | 'week' | 'month'

const OBJECTIFS = {
  day: 200,
  week: 1000,
  month: 4000
}

const MONTHS = [
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' }
]

const WEEKS = Array.from({ length: 53 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `Semaine ${i + 1}`
}))

export default function PerformanceDashboard() {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  
  const [period, setPeriod] = useState<PeriodType>('day')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [selectedMember, setSelectedMember] = useState('all')
  
  const [performance, setPerformance] = useState<PerformanceData[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [minutesByDayOfWeek, setMinutesByDayOfWeek] = useState<DayOfWeekData[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrendData[]>([])
  const [stats, setStats] = useState({ totalProjects: 0, totalMinutes: 0, moyenneJour: 0, memberCount: 0 })
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [teamStats, setTeamStats] = useState({ totalMinutes: 0, objectif: 0, pourcentage: 0 })
  const [allMembers, setAllMembers] = useState<Array<{ id: string; name: string; jobRole: string }>>([])

  const user = sessionData?.user as any
  const isAdmin = user?.role === 'ADMIN'

  const getDateRange = useCallback(() => {
    let startDate: Date
    let endDate: Date

    if (period === 'day') {
      startDate = new Date(selectedDate)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(selectedDate)
      endDate.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      // ✅ CORRECTION: Semaine commence le DIMANCHE (jour 0), finit le SAMEDI (jour 6)
      const weekNum = parseInt(selectedWeek)
      const firstDayOfYear = new Date(selectedYear, 0, 1)
      
      const firstSunday = new Date(firstDayOfYear)
      const daysToFirstSunday = (7 - firstDayOfYear.getDay()) % 7
      firstSunday.setDate(firstDayOfYear.getDate() + daysToFirstSunday)
      
      const daysToAdd = (weekNum - 1) * 7
      startDate = new Date(firstSunday)
      startDate.setDate(firstSunday.getDate() + daysToAdd)
      startDate.setHours(0, 0, 0, 0)
      
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)
    } else {
      // ✅ Si selectedMonth est vide, utiliser le mois courant
      const monthStr = selectedMonth || (new Date().getMonth() + 1).toString()
      const month = parseInt(monthStr) - 1
      startDate = new Date(selectedYear, month, 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(selectedYear, month + 1, 0)
      endDate.setHours(23, 59, 59, 999)
    }

    return { startDate, endDate }
  }, [selectedDate, selectedWeek, selectedMonth, selectedYear, period])

  const getPeriodLabel = useCallback(() => {
    const { startDate, endDate } = getDateRange()
    
    if (period === 'day') {
      return selectedDate.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    } else if (period === 'week') {
      const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      return `Semaine ${selectedWeek} du ${startStr} au ${endStr} ${endDate.getFullYear()}`
    } else {
      const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || ''
      return `${monthName} ${selectedYear}`
    }
  }, [selectedDate, selectedWeek, selectedMonth, selectedYear, period, getDateRange])

  const getObjectif = useCallback(() => {
    return OBJECTIFS[period]
  }, [period])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, isAdmin])

  const fetchMembers = useCallback(async (team: string) => {
    try {
      setLoadingMembers(true)
      const res = await fetch(`/api/users/all?team=${team}`)
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
      
      // ✅ FORÇAGE ABSOLU : On utilise uniquement la date sélectionnée pour jour/semaine/mois
      const targetDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      
      let finalDateFrom = targetDateStr
      let finalDateTo = targetDateStr

      if (period === 'week' && selectedWeek) {
        const weekNum = parseInt(selectedWeek)
        const firstDayOfYear = new Date(selectedYear, 0, 1)
        
        const firstSunday = new Date(firstDayOfYear)
        const daysToFirstSunday = (7 - firstDayOfYear.getDay()) % 7
        firstSunday.setDate(firstDayOfYear.getDate() + daysToFirstSunday)
        
        const daysToAdd = (weekNum - 1) * 7
        const startDate = new Date(firstSunday)
        startDate.setDate(firstSunday.getDate() + daysToAdd)
        
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 6)
        
        finalDateFrom = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        finalDateTo = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      } else if (period === 'month' && selectedMonth) {
        const month = parseInt(selectedMonth) - 1
        const startDate = new Date(selectedYear, month, 1)
        const endDate = new Date(selectedYear, month + 1, 0)
        finalDateFrom = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        finalDateTo = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      }

      const params = new URLSearchParams({
        dateFrom: finalDateFrom,
        dateTo: finalDateTo,
        team: selectedTeam,
        period: period
      })
      
      if (selectedMember !== 'all') {
        params.set('memberIds', selectedMember)
      }
      
      const res = await fetch(`/api/projects/performance?${params.toString()}`)
      const data = await res.json()
      
      const adjustedPerformance = (data.performanceByMember || []).map((p: PerformanceData) => ({
        ...p,
        objectif: getObjectif()
      }))
      
      setPerformance(adjustedPerformance)
      setDailyData(data.dailyPerformance || [])
      
      // ✅ Calculer les minutes par jour de la semaine
      const dayOfWeekData = calculateMinutesByDayOfWeek(data.projects || [])
      // ✅ Objectif quotidien fixe à 200 min pour le graphique d'évolution quotidienne
const trendData = calculateDailyTrend(data.dailyPerformance || [], 200)
      
      setMinutesByDayOfWeek(dayOfWeekData)
      setDailyTrend(trendData)
      
      setStats(data.stats || {})
      
      const totalMinutes = adjustedPerformance.reduce((sum: number, p: PerformanceData) => sum + p.totalMinutes, 0)
      const pourcentage = Math.round((totalMinutes / getObjectif()) * 100)
      
      setTeamStats({
        totalMinutes,
        objectif: getObjectif(),
        pourcentage
      })
      
      setAlerts(data.alerts || [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedWeek, selectedMonth, selectedYear, period, selectedTeam, selectedMember, getObjectif])

  const calculateMinutesByDayOfWeek = (projects: any[]): DayOfWeekData[] => {
    const daysOfWeek: DayOfWeekData[] = [
      { day: 'Lundi', dayShort: 'Lun', minutes: 0 },
      { day: 'Mardi', dayShort: 'Mar', minutes: 0 },
      { day: 'Mercredi', dayShort: 'Mer', minutes: 0 },
      { day: 'Jeudi', dayShort: 'Jeu', minutes: 0 },
      { day: 'Vendredi', dayShort: 'Ven', minutes: 0 },
      { day: 'Samedi', dayShort: 'Sam', minutes: 0 },
      { day: 'Dimanche', dayShort: 'Dim', minutes: 0 }
    ]

    projects.forEach(project => {
      const dateStr = project.isWritten ? project.writtenAt : project.mixedAt
      if (dateStr) {
        const projectDate = new Date(dateStr)
        const dayOfWeek = projectDate.getDay()
        const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        
        if (index >= 0 && index < 7) {
          daysOfWeek[index].minutes += project.durationMin || 0
        }
      }
    })

    return daysOfWeek
  }

  const calculateDailyTrend = (dailyData: DailyData[], objectif: number): DailyTrendData[] => {
    return dailyData.map(d => ({
      date: d.date,
      label: d.label,
      minutes: Object.values(d.byMember).reduce((sum, member) => sum + member.minutes, 0),
      objectif: objectif
    }))
  }

  useEffect(() => {
    if (user) {
      fetchPerformance()
      fetchMembers(selectedTeam)
    }
  }, [user, selectedTeam, fetchPerformance, fetchMembers])

  const barChartData = useMemo(() => {
    return performance.map(p => ({
      name: p.name.split(' ')[0],
      minutes: p.totalMinutes,
      objectif: p.objectif,
      projects: p.projectCount
    }))
  }, [performance])

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-100'
    if (minutes < 100) return 'bg-red-200'
    if (minutes < 200) return 'bg-orange-200'
    return 'bg-emerald-200'
  }

  const generateReport = () => {
    const periodLabel = getPeriodLabel()
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
      <div class="header"><h1>📊 Rapport Performance</h1><div class="platform"> Plateforme VDM by Formajob</div></div>
      <p><strong>Période:</strong> ${periodLabel} | <strong>Objectif:</strong> ${getObjectif()} min | <strong>Équipe:</strong> ${selectedTeam === 'redaction' ? 'Rédaction' : selectedTeam === 'mixage' ? 'Mixage' : 'Toutes'}</p>
      <div class="stats">
        <div class="stat"><div class="stat-label">Projets</div><div class="stat-value">${stats.totalProjects}</div></div>
        <div class="stat"><div class="stat-label">Minutes</div><div class="stat-value">${stats.totalMinutes}</div></div>
        <div class="stat"><div class="stat-label">Objectif</div><div class="stat-value">${getObjectif()} min</div></div>
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
    a.download = `rapport-${period}-${selectedDate.toISOString().split('T')[0]}.html`
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

  const periodLabel = getPeriodLabel()
  const objectif = getObjectif()

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
              Performance des Équipes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {periodLabel}
            </p>
          </div>
          <Button onClick={generateReport} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Rapport
          </Button>
        </div>

        {/* FILTRES ADAPTATIFS */}
        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Période</Label>
                <Select value={period} onValueChange={(v: PeriodType) => {
                  setPeriod(v)
                  if (v === 'day') setSelectedDate(new Date())
                  else if (v === 'week') {
                    setSelectedWeek('')
                    setSelectedYear(new Date().getFullYear())
                  }
                  else if (v === 'month') {
                    setSelectedMonth((new Date().getMonth() + 1).toString())
                    setSelectedYear(new Date().getFullYear())
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Jour (200 min)</SelectItem>
                    <SelectItem value="week">Semaine (1000 min)</SelectItem>
                    <SelectItem value="month">Mois (4000 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-600">
                  {period === 'day' ? 'Date' : period === 'week' ? 'Numéro de semaine' : 'Mois'}
                </Label>
                
                {period === 'day' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="w-4 h-4 mr-2" />
                        {selectedDate ? selectedDate.toLocaleDateString('fr-FR') : 'Choisir une date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
                
                {period === 'week' && (
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une semaine" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKS.map(week => (
                        <SelectItem key={week.value} value={week.value}>
                          {week.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {period === 'month' && (
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un mois" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(month => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {(period === 'week' || period === 'month') && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Année</Label>
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Équipe</Label>
                <Select value={selectedTeam} onValueChange={(v) => { setSelectedTeam(v); fetchMembers(v) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les équipes</SelectItem>
                    <SelectItem value="redaction">Rédaction</SelectItem>
                    <SelectItem value="mixage">Mixage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Membre</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingMembers ? 'Chargement...' : 'Tous'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {allMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4 pt-4 border-t">
              <Button onClick={fetchPerformance} size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* STATS CARDS */}
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
                Objectif
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{objectif} min</p>
              <p className="text-xs text-slate-500">
                {period === 'day' ? 'quotidien' : period === 'week' ? 'hebdomadaire' : 'mensuel'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${teamStats.pourcentage >= 100 ? 'text-emerald-600' : teamStats.pourcentage >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                {teamStats.pourcentage}%
              </p>
              <p className="text-xs text-slate-500">
                {teamStats.totalMinutes} / {objectif} min
              </p>
            </CardContent>
          </Card>
        </div>

        {/* GRAPHIQUES */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Performance par Membre */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-indigo-600" />
                Performance par Membre - Objectif: {objectif} min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="minutes" fill="#4f46e5" name="Minutes" radius={[4, 4, 0, 0]}>
                    <LabelList 
                      dataKey="minutes" 
                      position="top" 
                      fill="#1e293b"
                      fontSize={12}
                      fontWeight="bold"
                    />
                  </Bar>
                  <Bar dataKey="objectif" fill="#cbd5e1" name="Objectif" radius={[4, 4, 0, 0]}>
                    <LabelList 
                      dataKey="objectif" 
                      position="top" 
                      fill="#64748b"
                      fontSize={12}
                      fontWeight="bold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Minutes par Jour de la Semaine */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Minutes par Jour de la Semaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={minutesByDayOfWeek} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="dayShort" 
                    stroke="#64748b" 
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${Math.round(value as number)} min`,
                      props.payload.day
                    ]}
                  />
                  <Bar dataKey="minutes" fill="#10b981" name="Minutes" radius={[4, 4, 0, 0]}>
                    <LabelList 
                      dataKey="minutes" 
                      position="top" 
                      fill="#1e293b"
                      fontSize={12}
                      fontWeight="bold"
                      formatter={(value: number) => `${Math.round(value)} min`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Évolution Quotidienne */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Évolution Quotidienne - Objectif: {objectif} min
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="label" 
                  stroke="#64748b" 
                  fontSize={12}
                />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: number) => [`${Math.round(value)} min`, 'Minutes']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  dot={{ fill: '#4f46e5', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Minutes réalisées"
                />
                <Line 
                  type="monotone" 
                  dataKey="objectif" 
                  stroke="#cbd5e1" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Objectif quotidien"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* TABLEAU HEATMAP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Vue détaillée par jour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Membre</th>
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
                    <tr key={m.userId} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{m.name}</td>
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
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-4">
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
                <span>100-200</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-200 rounded" />
                <span>&gt;200</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ALERTES */}
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

        {/* TABLEAU PERFORMANCE PAR MEMBRE */}
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

      </div>
    </DashboardLayout>
  )
}