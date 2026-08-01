'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  TrendingUp, Activity, Clock, Target, Calendar, Trophy, Medal, Award, User,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Filter
} from 'lucide-react'
import { useEffect, useState, useCallback, useMemo } from 'react'
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
  LabelList
} from 'recharts'

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
  totalMembres: number
}

interface DailyData {
  date: string
  label: string
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

export default function MemberPerformance() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [period, setPeriod] = useState<PeriodType>('day')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  
  const [performance, setPerformance] = useState<PerformanceData[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [minutesByDayOfWeek, setMinutesByDayOfWeek] = useState<DayOfWeekData[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrendData[]>([])
  const [teamStats, setTeamStats] = useState({ totalMinutes: 0, objectif: 0, pourcentage: 0 })
  const [myPerformance, setMyPerformance] = useState<PerformanceData | null>(null)
  const [myRank, setMyRank] = useState<number>(0)
  const [totalMembers, setTotalMembers] = useState<number>(0)

  const isLoading = status === 'loading' || loading
  const user = session?.user as any
  const isMember = user?.role === 'MEMBER'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

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

  const fetchPerformance = useCallback(async () => {
    if (!user?.id) return

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
        period: period,
        team: 'all'
      })
      
      if (isMember && user.id) {
        params.set('memberId', user.id)
        params.set('includeTeam', 'true')
      }
      
      const res = await fetch(`/api/projects/performance?${params.toString()}`)
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      
      // ✅ Ajuster les objectifs selon la période
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
      
      // ✅ Calculer les stats d'équipe avec objectif dynamique
      const totalMinutes = adjustedPerformance.reduce((sum: number, p: PerformanceData) => sum + p.totalMinutes, 0)
      const totalObjectif = adjustedPerformance.reduce((sum: number, p: PerformanceData) => sum + p.objectif, 0)
      const pourcentage = totalObjectif > 0 ? Math.round((totalMinutes / totalObjectif) * 100) : 0
      
      setTeamStats({
        totalMinutes,
        objectif: totalObjectif,
        pourcentage
      })
      
      if (isMember && user.id) {
        const myStats = data.myStats || adjustedPerformance.find((m: PerformanceData) => m.userId === user.id)
        
        if (myStats) {
          setMyPerformance(myStats)
          setMyRank(myStats.rang)
          setTotalMembers(adjustedPerformance.length || 0)
        } else {
          setMyPerformance({
            userId: user.id,
            name: user.name || 'Unknown',
            jobRole: user.jobRole || '',
            projectCount: 0,
            totalMinutes: 0,
            objectif: getObjectif(),
            ecart: -getObjectif(),
            moyenneJour: 0,
            rang: 0,
            totalMembres: adjustedPerformance.length || 0
          })
          setTotalMembers(adjustedPerformance.length || 0)
        }
      }
    } catch (err) {
      console.error('Error:', err)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedWeek, selectedMonth, selectedYear, period, isMember, user?.id, getObjectif])

  useEffect(() => {
    if (status === 'authenticated' && user) {
      fetchPerformance()
    }
  }, [status, user, fetchPerformance])

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

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-100'
    if (minutes < 100) return 'bg-red-200'
    if (minutes < 200) return 'bg-orange-200'
    return 'bg-emerald-200'
  }

  const getRankBadge = (rang: number) => {
    if (rang === 1) return <><Trophy className="w-5 h-5 text-yellow-500 inline" /> 1er</>
    if (rang === 2) return <><Medal className="w-5 h-5 text-gray-400 inline" /> 2ème</>
    if (rang === 3) return <><Award className="w-5 h-5 text-amber-600 inline" /> 3ème</>
    return `${rang}ème`
  }

  // ✅ Données pour le graphique en barres
  const barChartData = useMemo(() => {
    return performance.map(p => ({
      name: p.name.split(' ')[0],
      minutes: p.totalMinutes,
      objectif: p.objectif,
      projects: p.projectCount
    }))
  }, [performance])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (status === 'unauthenticated' || !user) {
    return null
  }

  const periodLabel = getPeriodLabel()
  const objectif = getObjectif()

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="h-6 w-6 text-indigo-600" />
            Ma Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.name} • {
              myPerformance?.jobRole === 'REDACTEUR' ? 'Rédaction' : 
              myPerformance?.jobRole === 'TECH_SON' ? 'Mixage' : 
              myPerformance?.jobRole === 'NARRATEUR' ? 'Narration' : 
              'Performance'
            } • {periodLabel}
          </p>
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

              <div className="flex items-end">
                <Button onClick={fetchPerformance} disabled={isLoading} className="gap-2">
                  <Filter className="w-4 h-4" />
                  {isLoading ? 'Chargement...' : 'Actualiser'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STATS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Minutes réalisées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-indigo-600">{myPerformance?.totalMinutes || 0}</p>
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
              <p className="text-2xl font-bold">
                {objectif} min
                <span className="text-xs text-slate-400 block mt-1">
                  {period === 'day' ? 'quotidien' : period === 'week' ? 'hebdomadaire' : 'mensuel'}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Écart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold flex items-center gap-1 ${
                (myPerformance?.ecart || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {(myPerformance?.ecart || 0) >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                {(myPerformance?.ecart || 0) >= 0 ? '+' : ''}{myPerformance?.ecart || 0} min
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Classement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {getRankBadge(myRank)} <span className="text-sm text-slate-400">/ {totalMembers}</span>
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
                Classement de l'équipe - Objectif: {objectif} min
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

        {/* PROGRESSION */}
        <Card className="border-indigo-200 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Progression vs Objectif
              </CardTitle>
              <Badge className={
                teamStats.pourcentage >= 100 ? 'bg-emerald-100 text-emerald-700' :
                teamStats.pourcentage >= 80 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }>
                {teamStats.pourcentage}% atteint
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="relative">
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

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Objectif</p>
                  <p className="text-lg font-bold text-slate-700">{objectif} min</p>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-indigo-500 mb-1">Réalisé</p>
                  <p className="text-lg font-bold text-indigo-700">{myPerformance?.totalMinutes || 0} min</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Moyenne/jour</p>
                  <p className="text-lg font-bold text-slate-700">{myPerformance?.moyenneJour || 0} min</p>
                </div>
              </div>

              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                teamStats.pourcentage >= 100 ? 'bg-emerald-50 text-emerald-700' :
                teamStats.pourcentage >= 80 ? 'bg-yellow-50 text-yellow-700' :
                teamStats.pourcentage >= 50 ? 'bg-orange-50 text-orange-700' :
                'bg-red-50 text-red-700'
              }`}>
                {teamStats.pourcentage >= 100 ? <CheckCircle2 className="w-5 h-5" /> :
                 teamStats.pourcentage >= 80 ? <TrendingUp className="w-5 h-5" /> :
                 <Activity className="w-5 h-5" />}
                <span className="font-medium text-sm">
                  {teamStats.pourcentage >= 100 ? '🎉 Objectif atteint ! Félicitations !' :
                   teamStats.pourcentage >= 80 ? '⚠️ Presque là ! Encore un effort !' :
                   teamStats.pourcentage >= 50 ? '📈 En bonne voie, continuez !' :
                   '🔴 Retard important, motivez-vous !'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CLASSEMENT */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-600" />
            Classement de l'équipe {myPerformance?.jobRole === 'REDACTEUR' ? 'Rédaction' : 'Mixage'}
          </h3>
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Rang</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Membre</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Projets</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Minutes</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Objectif</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Écart</th>
                </tr>
              </thead>
              <tbody>
                {performance.map(m => (
                  <tr 
                    key={m.userId} 
                    className={`border-t transition-colors ${
                      m.userId === user?.id 
                        ? 'bg-indigo-50 border-indigo-200' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      {m.rang === 1 ? '🥇' : m.rang === 2 ? '🥈' : m.rang === 3 ? '🥉' : 
                       <span className="text-slate-400">{m.rang}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.userId === user?.id && (
                          <Badge className="bg-indigo-600 text-white text-[10px]">Moi</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-xs bg-slate-50">
                        {m.projectCount} projets
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold text-indigo-600">{m.totalMinutes}</span>
                      <span className="text-xs text-slate-400 ml-1">min</span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500">{m.objectif}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={
                        m.ecart >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }>
                        {m.ecart >= 0 ? '+' : ''}{m.ecart}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {performance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucune donnée pour cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTIVITÉ PAR JOUR */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Mon activité par jour
          </h3>
          <div className="bg-white rounded-xl border overflow-x-auto p-4 shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 sticky left-0 bg-white">Moi</th>
                  {dailyData.map(d => (
                    <th key={d.date} className="text-center py-2 px-2 font-medium text-slate-600">
                      {d.label}
                    </th>
                  ))}
                  <th className="text-center py-2 px-3 font-medium text-slate-600 bg-indigo-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {performance.filter(m => m.userId === user?.id).map(m => (
                  <tr key={m.userId} className="border-t">
                    <td className="py-2 px-3 font-medium sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <Badge className="bg-indigo-600 text-white text-[10px]">Moi</Badge>
                      </div>
                    </td>
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
                    <td className="py-2 px-3 text-center font-semibold bg-indigo-50">
                      {m.totalMinutes} min
                    </td>
                  </tr>
                ))}
                {performance.filter(m => m.userId === user?.id).length === 0 && (
                  <tr>
                    <td colSpan={dailyData.length + 2} className="py-8 text-center text-slate-400">
                      Aucune activité pour cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Légende (min/jour) :</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-100 rounded" /><span>0</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 rounded" /><span>&lt;100</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 rounded" /><span>100-200</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-200 rounded" /><span>&gt;200</span>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}