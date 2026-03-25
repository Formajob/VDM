'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  Coffee,
  UtensilsCrossed,
  Users,
  BookOpen,
  Handshake,
  UserX,
  Palmtree,
  Play,
  AlertTriangle,
  Download,
  RefreshCw,
  LogOut,
} from 'lucide-react'

type AttendanceStatus = 'EN_PRODUCTION' | 'PAUSE' | 'LUNCH' | 'REUNION' | 'RENCONTRE' | 'FORMATION' | 'ABSENT' | 'CONGE'

interface AttendanceRecord {
  id: string
  userId: string
  status: AttendanceStatus
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
  user: {
    id: string
    name: string
    email: string
    jobRole: string | null
  }
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string; limitMin: number | null }> = {
  EN_PRODUCTION: { label: 'Shift', icon: <Play className="w-3 h-3" />, color: 'text-indigo-700', bgColor: 'bg-indigo-100', limitMin: 450 },
  PAUSE: { label: 'Pause', icon: <Coffee className="w-3 h-3" />, color: 'text-amber-700', bgColor: 'bg-amber-100', limitMin: 30 },
  LUNCH: { label: 'Lunch', icon: <UtensilsCrossed className="w-3 h-3" />, color: 'text-orange-700', bgColor: 'bg-orange-100', limitMin: 60 },
  REUNION: { label: 'Réunion', icon: <Users className="w-3 h-3" />, color: 'text-blue-700', bgColor: 'bg-blue-100', limitMin: 60 },
  RENCONTRE: { label: 'Rencontre', icon: <Handshake className="w-3 h-3" />, color: 'text-purple-700', bgColor: 'bg-purple-100', limitMin: 60 },
  FORMATION: { label: 'Formation', icon: <BookOpen className="w-3 h-3" />, color: 'text-emerald-700', bgColor: 'bg-emerald-100', limitMin: 60 },
  ABSENT: { label: 'Absent', icon: <UserX className="w-3 h-3" />, color: 'text-red-700', bgColor: 'bg-red-100', limitMin: null },
  CONGE: { label: 'Congé', icon: <Palmtree className="w-3 h-3" />, color: 'text-teal-700', bgColor: 'bg-teal-100', limitMin: null },
  DEPART: { label: 'Parti', icon: <LogOut className="w-3 h-3" />, color: 'text-slate-600', bgColor: 'bg-slate-100', limitMin: null },
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

interface MemberStatus {
  user: { id: string; name: string; email: string; jobRole: string | null }
  activeRecord: AttendanceRecord | null
  todayRecords: AttendanceRecord[]
  totalShiftMin: number
  departed: boolean
  alerts: string[]
}

export default function AdminAttendanceView() {
  const [memberStatuses, setMemberStatuses] = useState<MemberStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance?all=true&date=${today}`)
      if (!res.ok) return
      const records: AttendanceRecord[] = await res.json()

      // Group by user
      const byUser = new Map<string, { user: AttendanceRecord['user']; records: AttendanceRecord[] }>()
      for (const r of records) {
        if (!byUser.has(r.userId)) {
          byUser.set(r.userId, { user: r.user, records: [] })
        }
        byUser.get(r.userId)!.records.push(r)
      }

      const statuses: MemberStatus[] = Array.from(byUser.values()).map(({ user, records }) => {
        const active = records.find(r => !r.endedAt) || null
        const departed = !active && records.length > 0 && records.some(r => r.endedAt)

        const now = Date.now()
        const totalShiftMin = records
          .filter(r => r.status === 'EN_PRODUCTION')
          .reduce((acc, r) => {
            if (r.durationMin) return acc + r.durationMin
            if (!r.endedAt) return acc + (now - new Date(r.startedAt).getTime()) / 60000
            return acc
          }, 0)

        // Generate alerts
        const alerts: string[] = []
        if (active) {
          const cfg = STATUS_CONFIG[active.status]
          const elapsed = (now - new Date(active.startedAt).getTime()) / 60000
          if (cfg?.limitMin && elapsed > cfg.limitMin) {
            alerts.push(`⚠️ Dépassement ${cfg.label} de ${formatDuration(elapsed - cfg.limitMin)}`)
          }
        }
        if (!active && !departed && records.length === 0) {
          alerts.push('❌ Absent non signalé')
        }
        if (departed && totalShiftMin < 450) {
          alerts.push(`🕐 Départ anticipé (${formatDuration(totalShiftMin)} / 7h30)`)
        }

        return { user, activeRecord: active, todayRecords: records, totalShiftMin, departed, alerts }
      })

      setMemberStatuses(statuses)
      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [today])

  // Auto-refresh every 30s
  useEffect(() => {
    fetchAll()
    const interval = setInterval(() => {
      fetchAll()
      setTick(t => t + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Live elapsed tick every second (for UI only)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const exportCSV = () => {
    const rows = [['Membre', 'Email', 'Rôle', 'Statut actuel', 'Shift total', 'Alertes']]
    for (const m of memberStatuses) {
      const cfg = m.activeRecord ? STATUS_CONFIG[m.activeRecord.status] : null
      rows.push([
        m.user.name,
        m.user.email,
        m.user.jobRole || '',
        m.departed ? 'Parti' : cfg?.label || 'Inactif',
        formatDuration(m.totalShiftMin),
        m.alerts.join(' | '),
      ])
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `presence-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const now = Date.now()
  const activeCount = memberStatuses.filter(m => m.activeRecord && !m.departed).length
  const departedCount = memberStatuses.filter(m => m.departed).length
  const alertCount = memberStatuses.filter(m => m.alerts.length > 0).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            Présence en temps réel
          </h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Mis à jour à {formatTime(lastUpdated.toISOString())} · Actualisation auto toutes les 30s
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-indigo-600">{activeCount}</div>
            <div className="text-xs text-muted-foreground">En activité</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-slate-200 dark:border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-slate-600">{departedCount}</div>
            <div className="text-xs text-muted-foreground">Partis</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{alertCount}</div>
            <div className="text-xs text-muted-foreground">Alertes</div>
          </CardContent>
        </Card>
      </div>

      {/* Member cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {memberStatuses.map((m) => {
          const cfg = m.activeRecord ? STATUS_CONFIG[m.activeRecord.status] : null
          const elapsed = m.activeRecord
            ? (now - new Date(m.activeRecord.startedAt).getTime()) / 60000
            : 0
          const isOvertime = cfg?.limitMin && elapsed > cfg.limitMin

          return (
            <Card
              key={m.user.id}
              className={`border-2 transition-all ${
                m.alerts.length > 0
                  ? 'border-red-300 dark:border-red-700'
                  : m.activeRecord
                  ? 'border-indigo-200 dark:border-indigo-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{m.user.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{m.user.jobRole || m.user.email}</p>
                  </div>
                  {m.departed ? (
                    <Badge className="bg-slate-100 text-slate-600 border-0 text-xs gap-1">
                      <LogOut className="w-3 h-3" /> Parti
                    </Badge>
                  ) : m.activeRecord && cfg ? (
                    <Badge className={`${cfg.bgColor} ${cfg.color} border-0 text-xs gap-1`}>
                      {cfg.icon} {cfg.label}
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Inactif</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Current timer */}
                {m.activeRecord && cfg && !m.departed && (
                  <div className={`rounded-lg p-2 ${cfg.bgColor} flex items-center justify-between`}>
                    <span className={`text-xs ${cfg.color}`}>
                      Depuis {formatTime(m.activeRecord.startedAt)}
                    </span>
                    <span className={`text-sm font-mono font-bold ${isOvertime ? 'text-red-600' : cfg.color}`}>
                      {formatDuration(elapsed)}
                      {isOvertime && ' ⚠️'}
                    </span>
                  </div>
                )}

                {/* Alerts */}
                {m.alerts.length > 0 && (
                  <div className="space-y-1">
                    {m.alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}

                {/* Today summary */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Shift total</span>
                  <span className={`font-semibold ${m.totalShiftMin >= 450 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {m.totalShiftMin > 0 ? formatDuration(m.totalShiftMin) : '—'}
                  </span>
                </div>

                {/* Mini history */}
                {m.todayRecords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.todayRecords.slice(0, 6).map((r) => {
                      const rc = STATUS_CONFIG[r.status]
                      return (
                        <span
                          key={r.id}
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${rc?.bgColor} ${rc?.color}`}
                        >
                          {rc?.icon}
                          {formatTime(r.startedAt)}
                        </span>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {memberStatuses.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            Aucun membre actif aujourd'hui
          </div>
        )}
      </div>
    </div>
  )
}
