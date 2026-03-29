'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { 
  Clock, Calendar, Users, Filter, Download, 
  CheckCircle, AlertTriangle, XCircle, TrendingUp, Search, Coffee, Utensils
} from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface AttendanceRecord {
  id: string
  userId: string
  date: string
  status: 'EN_PRODUCTION' | 'PAUSE' | 'LUNCH' | 'REUNION' | 'FORMATION' | 'AUTRE' | 'ABSENT'
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
  user?: { name: string; email: string; jobRole: string }
  plannedShift?: { start: string; end: string }
  isLate?: boolean
  isEarlyDeparture?: boolean
  lateMinutes?: number
  earlyMinutes?: number
  adherencePercent?: number
}

interface DailyStats {
  date: string
  totalRecords: number
  onTime: number
  late: number
  earlyDeparture: number
  absences: number
  overruns: number
  avgAdherence: number
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(date: Date): string {
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return 'Date invalide'
  }
}

function formatTime(dateString: string): string {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function formatDateInTable(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch {
    return 'Date invalide'
  }
}

function getStatusBadge(status: string) {
  const config: Record<string, { label: string; color: string; icon?: any }> = {
    EN_PRODUCTION: { label: 'Production', color: 'bg-indigo-100 text-indigo-700' },
    PAUSE: { label: 'Pause', color: 'bg-amber-100 text-amber-700', icon: Coffee },
    LUNCH: { label: 'Déjeuner', color: 'bg-orange-100 text-orange-700', icon: Utensils },
    REUNION: { label: 'Réunion', color: 'bg-blue-100 text-blue-700' },
    FORMATION: { label: 'Formation', color: 'bg-emerald-100 text-emerald-700' },
    AUTRE: { label: 'Autre', color: 'bg-slate-100 text-slate-700' },
    ABSENT: { label: 'Absent', color: 'bg-red-100 text-red-700' },
  }
  const cfg = config[status] || { label: status, color: 'bg-slate-100 text-slate-700' }
  return <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
}

function getPerformanceBadge(record: AttendanceRecord) {
  if (record.status === 'ABSENT') {
    return <Badge className="bg-red-100 text-red-700 border-0"><XCircle className="w-3 h-3 mr-1" />Absence</Badge>
  }
  
  // ✅ Vérifier les dépassements PAUSE/LUNCH
  if (record.status === 'PAUSE' && (record.durationMin || 0) > 30) {
    return <Badge className="bg-orange-100 text-orange-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Dépassement ({record.durationMin}min)</Badge>
  }
  if (record.status === 'LUNCH' && (record.durationMin || 0) > 60) {
    return <Badge className="bg-orange-100 text-orange-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Dépassement ({record.durationMin}min)</Badge>
  }
  
  if (record.isLate && record.isEarlyDeparture) {
    return <Badge className="bg-red-100 text-red-700 border-0"><XCircle className="w-3 h-3 mr-1" />Retard + Départ</Badge>
  }
  if (record.isLate) {
    return <Badge className="bg-amber-100 text-amber-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Retard ({record.lateMinutes}min)</Badge>
  }
  if (record.isEarlyDeparture) {
    return <Badge className="bg-orange-100 text-orange-700 border-0"><Clock className="w-3 h-3 mr-1" />Départ ({record.earlyMinutes}min)</Badge>
  }
  return <Badge className="bg-emerald-100 text-emerald-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />À l'heure</Badge>
}

export default function AdminAttendanceHistoryPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [members, setMembers] = useState<{ id: string; name: string; jobRole: string }[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d
  })
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (!isAdmin && !isDemo) router.push('/dashboard')
  }, [status, router, isDemo, isAdmin])

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/users')
    if (res.ok) {
      const users = await res.json()
      const membersOnly = users.filter((u: any) => u.role === 'MEMBER')
      setMembers(membersOnly)
    }
  }, [])

  const fetchAttendanceRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      })
      if (selectedMember !== 'all') {
        params.set('userId', selectedMember)
      }

      const res = await fetch(`/api/attendance?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRecords(data)
        calculateDailyStats(data)
      }
    } catch {
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedMember])

  const calculateDailyStats = (data: AttendanceRecord[]) => {
    const statsMap = new Map<string, DailyStats>()
    
    data.forEach(record => {
      const date = record.startedAt.split('T')[0]
      if (!statsMap.has(date)) {
        statsMap.set(date, { 
          date, 
          totalRecords: 0, 
          onTime: 0, 
          late: 0, 
          earlyDeparture: 0, 
          absences: 0,
          overruns: 0,
          avgAdherence: 0 
        })
      }
      const stats = statsMap.get(date)!
      stats.totalRecords++
      if (record.status === 'ABSENT') {
        stats.absences++
      } else if (record.isLate) {
        stats.late++
      } else if (record.isEarlyDeparture) {
        stats.earlyDeparture++
      } else {
        stats.onTime++
      }
      // Compter les dépassements (pause > 30min ou lunch > 60min)
      if ((record.status === 'PAUSE' && (record.durationMin || 0) > 30) ||
          (record.status === 'LUNCH' && (record.durationMin || 0) > 60)) {
        stats.overruns++
      }
    })

    setDailyStats(Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date)))
  }

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchAttendanceRecords()
  }, [fetchAttendanceRecords])

  const getFilteredRecords = () => {
    let filtered = records

    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'late') {
        filtered = filtered.filter(r => r.isLate && r.lateMinutes !== 999)
      } else if (statusFilter === 'early') {
        filtered = filtered.filter(r => r.isEarlyDeparture && !r.isLate)
      } else if (statusFilter === 'ontime') {
        filtered = filtered.filter(r => !r.isLate && !r.isEarlyDeparture && r.status !== 'ABSENT')
      } else if (statusFilter === 'absent') {
        filtered = filtered.filter(r => r.status === 'ABSENT')
      } else if (statusFilter === 'overrun') {
        filtered = filtered.filter(r => 
          (r.status === 'PAUSE' && (r.durationMin || 0) > 30) ||
          (r.status === 'LUNCH' && (r.durationMin || 0) > 60)
        )
      } else {
        filtered = filtered.filter(r => r.status === statusFilter)
      }
    }

    return filtered
  }

  const handleExportCSV = () => {
    const filtered = getFilteredRecords()
    let csv = 'Date,Membre,Rôle,Statut,Début,Fin,Durée,Retard,Départ anticipé,Note\n'
    
    filtered.forEach(r => {
      const row = [
        r.startedAt.split('T')[0],
        `"${r.user?.name || 'N/A'}"`,
        `"${r.user?.jobRole || 'N/A'}"`,
        r.status,
        formatTime(r.startedAt),
        formatTime(r.endedAt || ''),
        r.durationMin ? `${r.durationMin}min` : '—',
        r.isLate ? `${r.lateMinutes}min` : 'Non',
        r.isEarlyDeparture ? `${r.earlyMinutes}min` : 'Non',
        `"${r.note || ''}"`
      ]
      csv += row.join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${formatDate(startDate)}_${formatDate(endDate)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export CSV téléchargé')
  }

 const getOverallStats = () => {
  const filtered = getFilteredRecords()
  
  let totalPlannedMinutes = 0
  let totalLostMinutes = 0
  let absences = 0
  let overruns = 0
  
  filtered.forEach(record => {
    // ✅ Calculer les minutes planifiées (pour EN_PRODUCTION et ABSENT)
    if (record.plannedShift?.start && record.plannedShift?.end) {
      const [startHour, startMin] = record.plannedShift.start.split(':').map(Number)
      const [endHour, endMin] = record.plannedShift.end.split(':').map(Number)
      const plannedMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
      totalPlannedMinutes += plannedMinutes
      
      // Si ABSENT → toutes les minutes sont perdues
      if (record.status === 'ABSENT') {
        totalLostMinutes += plannedMinutes
        absences++
      } else {
        // ✅ Pour EN_PRODUCTION : compter retards et départs anticipés
        if (record.lateMinutes && record.lateMinutes > 0 && record.lateMinutes < 999) {
          totalLostMinutes += record.lateMinutes
        }
        
        if (record.earlyMinutes && record.earlyMinutes > 0) {
          totalLostMinutes += record.earlyMinutes
        }
      }
    }
    
    // Dépassement PAUSE (> 30 min)
    if (record.status === 'PAUSE' && record.durationMin) {
      const overrun = Math.max(0, record.durationMin - 30)
      if (overrun > 0) {
        totalLostMinutes += overrun
        overruns++
      }
    }
    
    // Dépassement LUNCH (> 60 min)
    if (record.status === 'LUNCH' && record.durationMin) {
      const overrun = Math.max(0, record.durationMin - 60)
      if (overrun > 0) {
        totalLostMinutes += overrun
        overruns++
      }
    }
  })
  
  // ✅ Comptage direct des absences
  const directAbsences = filtered.filter(r => r.status === 'ABSENT').length
  absences = directAbsences
  
  // ✅ Calcul adhérence
  const adherence = totalPlannedMinutes > 0 
    ? Math.max(0, Math.round(((totalPlannedMinutes - totalLostMinutes) / totalPlannedMinutes) * 100))
    : 0  // ✅ Si pas de minutes planifiées, adhérence = 0 (pas 100!)

  const total = filtered.length
  const late = filtered.filter(r => r.isLate && r.lateMinutes !== 999).length  // ✅ Exclure les absences
  const early = filtered.filter(r => r.isEarlyDeparture && !r.isLate).length
  const onTime = filtered.filter(r => !r.isLate && !r.isEarlyDeparture && r.status !== 'ABSENT').length

  return { total, onTime, late, early, absences, overruns, adherence }
}

  const stats = getOverallStats()

  if (status === 'loading' && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isAdmin && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <p className="text-muted-foreground">Accès réservé aux administrateurs</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>Retour</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Historique des Présences
          </h1>
          <p className="text-muted-foreground">Consultez l'historique complet des pointages de l'équipe</p>
        </div>

        {/* Stats Overview - BASÉ SUR LES FILTRES */}
        <div className="grid sm:grid-cols-5 gap-4">
          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Absences</p>
                  <p className="text-2xl font-bold text-red-600">{stats.absences}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Retards</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Départs anticipés</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.early}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Dépassements</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overruns}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Adhérence</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.adherence}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-5 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Du</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDisplayDate(startDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Au</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDisplayDate(endDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Member Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Membre</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">👥 Tous les membres</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Statut</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="ontime">✅ À l'heure</SelectItem>
                    <SelectItem value="late">⚠️ Retards</SelectItem>
                    <SelectItem value="early">🕐 Départs anticipés</SelectItem>
                    <SelectItem value="absent">❌ Absences</SelectItem>
                    <SelectItem value="overrun">⏱️ Dépassements</SelectItem>
                    <SelectItem value="EN_PRODUCTION">Production</SelectItem>
                    <SelectItem value="PAUSE">Pause</SelectItem>
                    <SelectItem value="LUNCH">Déjeuner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Recherche</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={fetchAttendanceRecords}>
                <Filter className="w-4 h-4 mr-2" />Actualiser
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />Exporter CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Daily Stats */}
        {dailyStats.length > 0 && (
          <Card className="border-2 border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Statistiques par jour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {dailyStats.map(stat => (
                  <div key={stat.date} className="p-3 bg-slate-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(stat.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-lg font-bold">{stat.totalRecords}</p>
                    <div className="flex items-center justify-center gap-1 text-xs mt-1">
                      <span className="text-emerald-600">{stat.onTime}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-amber-600">{stat.late}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-orange-600">{stat.earlyDeparture}</span>
                      {stat.overruns > 0 && (
                        <>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">{stat.overruns}</span>
                        </>
                      )}
                    </div>
                    {stat.absences > 0 && (
                      <p className="text-xs text-red-600 mt-1">{stat.absences} absent</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                ✅ À l'heure / ⚠️ Retards / 🕐 Départs / 🔴 Dépassements
              </p>
            </CardContent>
          </Card>
        )}

        {/* Records Table */}
        <Card className="border-2 border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Pointages ({getFilteredRecords().length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : getFilteredRecords().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Aucun pointage pour cette période</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Membre</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Rôle</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Statut</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Début</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Fin</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Durée</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Performance</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredRecords().map(record => (
                      <tr key={record.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2">
                          {formatDateInTable(record.startedAt)}
                        </td>
                        <td className="px-3 py-2 font-medium">{record.user?.name || 'N/A'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{record.user?.jobRole || 'N/A'}</td>
                        <td className="px-2 py-2 text-center">{getStatusBadge(record.status)}</td>
                        <td className="px-2 py-2 text-center font-mono">{formatTime(record.startedAt)}</td>
                        <td className="px-2 py-2 text-center font-mono">{formatTime(record.endedAt || '')}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {record.durationMin ? `${record.durationMin}min` : '—'}
                        </td>
                        <td className="px-2 py-2 text-center">{getPerformanceBadge(record)}</td>
                        <td className="px-2 py-2 text-muted-foreground max-w-[150px] truncate">
                          {record.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}