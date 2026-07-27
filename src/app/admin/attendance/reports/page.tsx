'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
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
  records: AttendanceRecord[]
}

interface TimeBlock {
  start: Date
  end: Date
  type: 'Shift' | 'pause' | 'Lunch' | 'Retard' | 'Départ anticipé' | 'Absence' | 'Dépassement pause'
  duration: string
  color: string
  label: string
  isIssue?: boolean
}

const TIME_BLOCK_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  'Shift': { bg: 'bg-emerald-500', border: 'border-emerald-600', label: 'Shift' },
  'pause': { bg: 'bg-yellow-200', border: 'border-yellow-300', label: 'Pause' },
  'Lunch': { bg: 'bg-amber-500', border: 'border-amber-600', label: 'Lunch' },
  'Retard': { bg: 'bg-red-600', border: 'border-red-700', label: 'Retard' },
  'Départ anticipé': { bg: 'bg-red-600', border: 'border-red-700', label: 'Départ anticipé' },
  'Absence': { bg: 'bg-red-700', border: 'border-red-800', label: 'Absence' },
  'Dépassement pause': { bg: 'bg-red-500', border: 'border-red-600', label: 'Dépassement' },
}

const STATUS_OPTIONS = [
  { value: 'EN_PRODUCTION', label: 'Production', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'PAUSE', label: 'Pause', color: 'bg-amber-100 text-amber-700', icon: Coffee },
  { value: 'LUNCH', label: 'Déjeuner', color: 'bg-orange-100 text-orange-700', icon: Utensils },
  { value: 'REUNION', label: 'Réunion', color: 'bg-blue-100 text-blue-700' },
  { value: 'FORMATION', label: 'Formation', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'AUTRE', label: 'Autre', color: 'bg-slate-100 text-slate-700' },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-100 text-red-700' },
]

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
  
  if (record.status === 'PAUSE' && (record.durationMin || 0) > 30) {
    return <Badge className="bg-red-100 text-red-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Dépassement ({record.durationMin}min)</Badge>
  }
  if (record.status === 'LUNCH' && (record.durationMin || 0) > 60) {
    return <Badge className="bg-red-100 text-red-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Dépassement ({record.durationMin}min)</Badge>
  }
  
  if (record.isLate && record.isEarlyDeparture) {
    return <Badge className="bg-red-100 text-red-700 border-0"><XCircle className="w-3 h-3 mr-1" />Retard + Départ</Badge>
  }
  if (record.isLate) {
    return <Badge className="bg-red-100 text-red-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Retard ({record.lateMinutes}min)</Badge>
  }
  if (record.isEarlyDeparture) {
    return <Badge className="bg-red-100 text-red-700 border-0"><Clock className="w-3 h-3 mr-1" />Départ ({record.earlyMinutes}min)</Badge>
  }
  return <Badge className="bg-emerald-100 text-emerald-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />À l'heure</Badge>
}

// ✅ COMPOSANT: Barre temporelle avec retards et dépassements en rouge
function DayTimeline({ records, date }: { records: AttendanceRecord[], date: string }) {
  const timeBlocks: TimeBlock[] = useMemo(() => {
    const blocks: TimeBlock[] = []
    
    if (!records || records.length === 0) return blocks

    // Shift standard: 8h00 - 17h00
    const plannedStart = new Date(date + 'T08:00:00')
    const plannedEnd = new Date(date + 'T17:00:00')
    
    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )
    
    sortedRecords.forEach(record => {
      const actualStart = new Date(record.startedAt)
      const actualEnd = record.endedAt ? new Date(record.endedAt) : new Date(actualStart.getTime() + (record.durationMin || 0) * 60000)
      const duration = record.durationMin || 0
      
      // ✅ DÉTECTION RETARD: Comparer début réel vs planning
      if (record.status === 'EN_PRODUCTION' && actualStart > plannedStart) {
        const lateMinutes = Math.floor((actualStart.getTime() - plannedStart.getTime()) / 60000)
        if (lateMinutes > 0) {
          blocks.push({
            start: plannedStart,
            end: actualStart,
            type: 'Retard',
            duration: `${Math.floor(lateMinutes / 60)}h${lateMinutes % 60}`.padStart(5, '0'),
            color: TIME_BLOCK_COLORS['Retard'].bg,
            label: 'Retard',
            isIssue: true
          })
        }
      }
      
      // ✅ DÉTECTION DÉPART ANTICIPÉ: Comparer fin réelle vs planning
      if (record.status === 'EN_PRODUCTION' && actualEnd < plannedEnd) {
        const earlyMinutes = Math.floor((plannedEnd.getTime() - actualEnd.getTime()) / 60000)
        if (earlyMinutes > 0 && record.endedAt) {
          blocks.push({
            start: actualEnd,
            end: plannedEnd,
            type: 'Départ anticipé',
            duration: `${Math.floor(earlyMinutes / 60)}h${earlyMinutes % 60}`.padStart(5, '0'),
            color: TIME_BLOCK_COLORS['Départ anticipé'].bg,
            label: 'Départ anticipé',
            isIssue: true
          })
        }
      }
      
      // ✅ DÉTECTION DÉPASSEMENT PAUSE
      if ((record.status === 'PAUSE' && duration > 30) || (record.status === 'LUNCH' && duration > 60)) {
        const maxDuration = record.status === 'PAUSE' ? 30 : 60
        const overrunMinutes = duration - maxDuration
        
        // Calculer le début du dépassement (après la durée normale)
        const overrunStart = new Date(actualStart.getTime() + maxDuration * 60000)
        
        blocks.push({
          start: overrunStart,
          end: actualEnd,
          type: 'Dépassement pause',
          duration: `${Math.floor(overrunMinutes / 60)}h${overrunMinutes % 60}`.padStart(5, '0'),
          color: TIME_BLOCK_COLORS['Dépassement pause'].bg,
          label: 'Dépassement',
          isIssue: true
        })
      }
      
      // Bloc normal
      let type: TimeBlock['type'] = 'Shift'
      if (record.status === 'ABSENT') type = 'Absence'
      else if (record.status === 'PAUSE') type = 'pause'
      else if (record.status === 'LUNCH') type = 'Lunch'
      
      const config = TIME_BLOCK_COLORS[type] || TIME_BLOCK_COLORS['Shift']
      
      blocks.push({
        start: actualStart,
        end: actualEnd,
        type,
        duration: `${Math.floor(duration / 60)}h${duration % 60}`.padStart(5, '0'),
        color: config.bg,
        label: config.label,
        isIssue: false
      })
    })
    
    // Trier les blocs par heure de début
    return blocks.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [records, date])

  if (timeBlocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 bg-slate-100 rounded">
        <span className="text-xs text-slate-400">Aucune donnée</span>
      </div>
    )
  }

  const dayStart = new Date(date + 'T08:00:00')
  const dayEnd = new Date(date + 'T17:00:00')
  const totalDayMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000

  return (
    <div className="space-y-2">
      <div className="flex text-[10px] text-slate-500 px-1">
        <div className="w-12 flex-shrink-0">08:00</div>
        <div className="flex-1 flex justify-between">
          <span>09:00</span>
          <span>10:00</span>
          <span>11:00</span>
          <span>12:00</span>
          <span>13:00</span>
          <span>14:00</span>
          <span>15:00</span>
          <span>16:00</span>
          <span>17:00</span>
        </div>
      </div>
      
      <div className="flex h-10 rounded overflow-hidden bg-slate-100 relative border border-slate-300">
        {timeBlocks.map((block, idx) => {
          const startMinutes = (block.start.getTime() - dayStart.getTime()) / 60000
          const endMinutes = (block.end.getTime() - dayStart.getTime()) / 60000
          const leftPercent = Math.max(0, Math.min(100, (startMinutes / totalDayMinutes) * 100))
          const widthPercent = Math.max(0, Math.min(100 - leftPercent, ((endMinutes - startMinutes) / totalDayMinutes) * 100))
          
          return (
            <div
              key={idx}
              className={`${block.color} absolute h-full border-r border-white/20 transition-all hover:opacity-80 cursor-pointer flex items-center justify-center ${block.isIssue ? 'animate-pulse' : ''}`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
              title={`${block.label}: ${formatTime(block.start.toISOString())} - ${formatTime(block.end.toISOString())} (${block.duration}) ${block.isIssue ? '⚠️' : ''}`}
            >
              {widthPercent > 10 && (
                <span className="text-[10px] text-white font-medium drop-shadow">
                  {block.isIssue && '⚠️ '}
                  {block.duration}
                </span>
              )}
            </div>
          )
        })}
      </div>
      
      <div className="flex flex-wrap gap-2 text-[10px]">
        {timeBlocks.map((block, idx) => (
          <div key={idx} className={`flex items-center gap-1 px-2 py-1 rounded ${block.isIssue ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
            <div className={`w-2 h-2 rounded-full ${block.color}`} />
            <span className={`font-medium ${block.isIssue ? 'text-red-700' : 'text-slate-600'}`}>{block.label}</span>
            <span className="text-slate-500">
              {formatTime(block.start.toISOString())} - {formatTime(block.end.toISOString())} ({block.duration})
            </span>
            {block.isIssue && <AlertTriangle className="w-3 h-3 text-red-600" />}
          </div>
        ))}
      </div>
    </div>
  )
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
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
        date: formatDate(selectedDate),
      })
      if (selectedMember !== 'all') {
        params.set('userId', selectedMember)
      }

      const res = await fetch(`/api/attendance?${params}`)
      if (res.ok) {
        const data = await res.json()
        
        // Calculer les retards et départs anticipés basés sur le planning
        const processedRecords = data.map((record: AttendanceRecord) => {
          if (record.plannedShift?.start && record.plannedShift?.end) {
            const plannedStart = new Date(`${record.date}T${record.plannedShift.start}`)
            const plannedEnd = new Date(`${record.date}T${record.plannedShift.end}`)
            const actualStart = new Date(record.startedAt)
            const actualEnd = record.endedAt ? new Date(record.endedAt) : null
            
            // Calcul du retard
            if (actualStart > plannedStart) {
              const lateMinutes = Math.floor((actualStart.getTime() - plannedStart.getTime()) / 60000)
              record.isLate = lateMinutes > 0
              record.lateMinutes = lateMinutes
            }
            
            // Calcul du départ anticipé
            if (actualEnd && actualEnd < plannedEnd) {
              const earlyMinutes = Math.floor((plannedEnd.getTime() - actualEnd.getTime()) / 60000)
              record.isEarlyDeparture = earlyMinutes > 0
              record.earlyMinutes = earlyMinutes
            }
          }
          
          return record
        })
        
        setRecords(processedRecords)
        calculateDailyStats(processedRecords)
      }
    } catch {
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedMember])

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
          avgAdherence: 0,
          records: []
        })
      }
      const stats = statsMap.get(date)!
      stats.totalRecords++
      stats.records.push(record)
      
      if (record.status === 'ABSENT') {
        stats.absences++
      } else if (record.isLate) {
        stats.late++
      } else if (record.isEarlyDeparture) {
        stats.earlyDeparture++
      } else {
        stats.onTime++
      }
      
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
    a.download = `attendance_${formatDate(selectedDate)}.csv`
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
      if (record.plannedShift?.start && record.plannedShift?.end) {
        const [startHour, startMin] = record.plannedShift.start.split(':').map(Number)
        const [endHour, endMin] = record.plannedShift.end.split(':').map(Number)
        const plannedMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
        totalPlannedMinutes += plannedMinutes
        
        if (record.status === 'ABSENT') {
          totalLostMinutes += plannedMinutes
          absences++
        } else {
          if (record.lateMinutes && record.lateMinutes > 0 && record.lateMinutes < 999) {
            totalLostMinutes += record.lateMinutes
          }
          
          if (record.earlyMinutes && record.earlyMinutes > 0) {
            totalLostMinutes += record.earlyMinutes
          }
        }
      }
      
      if (record.status === 'PAUSE' && record.durationMin) {
        const overrun = Math.max(0, record.durationMin - 30)
        if (overrun > 0) {
          totalLostMinutes += overrun
          overruns++
        }
      }
      
      if (record.status === 'LUNCH' && record.durationMin) {
        const overrun = Math.max(0, record.durationMin - 60)
        if (overrun > 0) {
          totalLostMinutes += overrun
          overruns++
        }
      }
    })
    
    const directAbsences = filtered.filter(r => r.status === 'ABSENT').length
    absences = directAbsences
    
    const adherence = totalPlannedMinutes > 0 
      ? Math.max(0, Math.round(((totalPlannedMinutes - totalLostMinutes) / totalPlannedMinutes) * 100))
      : 0

    const total = filtered.length
    const late = filtered.filter(r => r.isLate && r.lateMinutes !== 999).length
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
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Historique des Présences
          </h1>
          <p className="text-muted-foreground">Consultez l'historique complet des pointages de l'équipe</p>
        </div>

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

          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Retards</p>
                  <p className="text-2xl font-bold text-red-600">{stats.late}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Départs anticipés</p>
                  <p className="text-2xl font-bold text-red-600">{stats.early}</p>
                </div>
                <Clock className="w-8 h-8 text-red-500" />
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

        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDisplayDate(selectedDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => d && setSelectedDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

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

        {dailyStats.length > 0 && (
          <Card className="border-2 border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Visualisation temporelle par jour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dailyStats.map(stat => (
                  <div key={stat.date} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-slate-800">
                          {new Date(stat.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {stat.totalRecords} pointages
                        </Badge>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="text-emerald-600">{stat.onTime} OK</span>
                        <span className="text-red-600">{stat.late} retards</span>
                        <span className="text-red-600">{stat.earlyDeparture} départs</span>
                        {stat.absences > 0 && <span className="text-red-600">{stat.absences} absences</span>}
                        {stat.overruns > 0 && <span className="text-red-600">{stat.overruns} dépassements</span>}
                      </div>
                    </div>
                    
                    <DayTimeline records={stat.records} date={stat.date} />
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <h4 className="text-sm font-semibold mb-2">Légende:</h4>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded" />
                    <span>Shift (Travail)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-200 rounded" />
                    <span>Pause</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded" />
                    <span>Lunch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded border-2 border-red-700" />
                    <span>Retard / Départ anticipé / Dépassement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-700 rounded" />
                    <span>Absence</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-2 border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Pointages ({getFilteredRecords().length}) - {formatDisplayDate(selectedDate)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : getFilteredRecords().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Aucun pointage pour le {formatDisplayDate(selectedDate)}</p>
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