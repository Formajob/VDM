'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Clock,
  Coffee,
  UtensilsCrossed,
  Users,
  BookOpen,
  Handshake,
  UserX,
  Palmtree,
  LogOut,
  Play,
  AlertTriangle,
} from 'lucide-react'

type AttendanceStatus =
  | 'EN_PRODUCTION'
  | 'PAUSE'
  | 'LUNCH'
  | 'REUNION'
  | 'RENCONTRE'
  | 'FORMATION'
  | 'ABSENT'
  | 'CONGE'

interface AttendanceRecord {
  id: string
  userId: string
  status: AttendanceStatus
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
}

interface StatusConfig {
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  limitMin: number | null
  description: string
}

const STATUS_CONFIG: Record<AttendanceStatus, StatusConfig> = {
  EN_PRODUCTION: {
    label: 'Shift',
    icon: <Play className="w-4 h-4" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100',
    borderColor: 'border-indigo-300',
    limitMin: 450, // 7h30
    description: '7h30 minimum',
  },
  PAUSE: {
    label: 'Pause',
    icon: <Coffee className="w-4 h-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    borderColor: 'border-amber-300',
    limitMin: 30,
    description: '30 min max',
  },
  LUNCH: {
    label: 'Lunch',
    icon: <UtensilsCrossed className="w-4 h-4" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    borderColor: 'border-orange-300',
    limitMin: 60,
    description: '60 min max',
  },
  REUNION: {
    label: 'Réunion',
    icon: <Users className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-300',
    limitMin: 60,
    description: '60 min',
  },
  RENCONTRE: {
    label: 'Rencontre',
    icon: <Handshake className="w-4 h-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-300',
    limitMin: 60,
    description: '60 min',
  },
  FORMATION: {
    label: 'Formation',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    borderColor: 'border-emerald-300',
    limitMin: 60,
    description: '60 min',
  },
  ABSENT: {
    label: 'Absent',
    icon: <UserX className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100',
    borderColor: 'border-red-300',
    limitMin: null,
    description: 'Sans limite',
  },
  CONGE: {
    label: 'Congé',
    icon: <Palmtree className="w-4 h-4" />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100',
    borderColor: 'border-teal-300',
    limitMin: null,
    description: 'Sans limite',
  },
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  const s = Math.floor((minutes * 60) % 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m${s.toString().padStart(2, '0')}s`
  return `${m}m${s.toString().padStart(2, '0')}s`
}

function formatTime(iso: string): string {
  return new Date(iso + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatMinutes(min: number | null): string {
  if (min === null) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

export default function AttendanceSection({ userId }: { userId: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [departed, setDeparted] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const fetchRecords = useCallback(async () => {
    const res = await fetch(`/api/attendance?date=${today}`)
    if (!res.ok) return
    const data: AttendanceRecord[] = await res.json()
    setRecords(data)
    const active = data.find((r) => !r.endedAt) || null
    setActiveRecord(active)
    // Check if departed today (last record has endedAt and no active)
    const hasDeparted = data.length > 0 && !active && data.some(r => r.endedAt)
    setDeparted(hasDeparted)
  }, [today])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // Live timer
  useEffect(() => {
  if (!activeRecord) { 
    setElapsed(0)
    return 
  }

  const start = new Date(activeRecord.startedAt + 'Z')

  const update = () => {
    const now = new Date()

    // ⚡ correction timezone
    const diffMs = now.getTime() - start.getTime()

    const diffMin = diffMs / 60000

    setElapsed(diffMin > 0 ? diffMin : 0)
  }

  update()
  const interval = setInterval(update, 1000)

  return () => clearInterval(interval)
}, [activeRecord])

  const handleStatus = async (status: AttendanceStatus | 'DEPART') => {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      if (status === 'DEPART') {
        setDeparted(true)
        setActiveRecord(null)
        toast.success('Bonne fin de journée ! Départ enregistré.')
      } else {
        toast.success(`Statut mis à jour : ${STATUS_CONFIG[status].label}`)
      }
      await fetchRecords()
    } catch {
      toast.error('Erreur lors du changement de statut')
    } finally {
      setLoading(false)
    }
  }

  // Overtime alert
  const isOvertime =
    activeRecord &&
    STATUS_CONFIG[activeRecord.status]?.limitMin !== null &&
    elapsed > (STATUS_CONFIG[activeRecord.status]?.limitMin ?? Infinity)

  // Total shift time today (EN_PRODUCTION records)
  const totalShiftMin = records
    .filter((r) => r.status === 'EN_PRODUCTION')
    .reduce((acc, r) => {
      if (r.durationMin) return acc + r.durationMin
      if (!r.endedAt && activeRecord?.id === r.id) return acc + elapsed
      return acc
    }, 0)

  const cfg = activeRecord ? STATUS_CONFIG[activeRecord.status] : null

  return (
    <div className="space-y-4">
      {/* Current status card */}
      <Card className={`border-2 transition-all ${
        activeRecord
          ? `${cfg?.borderColor} shadow-lg`
          : 'border-slate-200 dark:border-slate-700'
      }`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Présence du jour
            </span>
            {totalShiftMin > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Shift total : <span className="font-semibold text-indigo-600">{formatMinutes(totalShiftMin)}</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active status display */}
          {activeRecord && cfg ? (
            <div className={`rounded-xl p-4 ${cfg.bgColor} border ${cfg.borderColor} transition-all`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${cfg.color}`}>{cfg.icon}</div>
                  <div>
                    <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Depuis {formatTime(activeRecord.startedAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-mono font-bold ${isOvertime ? 'text-red-600' : cfg.color}`}>
                    {formatDuration(elapsed)}
                  </p>
                  {cfg.limitMin && (
                    <p className="text-xs text-muted-foreground">{cfg.description}</p>
                  )}
                </div>
              </div>
              {isOvertime && (
                <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Dépassement de {formatDuration(elapsed - (cfg.limitMin ?? 0))} !</span>
                </div>
              )}
            </div>
          ) : departed ? (
            <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <LogOut className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Départ enregistré</p>
              <p className="text-xs text-muted-foreground">Bonne fin de journée !</p>
            </div>
          ) : (
            <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 text-center">
              <p className="text-sm text-muted-foreground">Aucun statut actif — sélectionnez un statut ci-dessous</p>
            </div>
          )}

          {/* Status buttons */}
          {!departed && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((status) => {
                const c = STATUS_CONFIG[status]
                const isActive = activeRecord?.status === status
                return (
                  <button
                    key={status}
                    onClick={() => handleStatus(status)}
                    disabled={loading || isActive}
                    className={`
                      flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-medium
                      transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                      ${isActive
                        ? `${c.borderColor} ${c.bgColor} ${c.color} ring-2 ring-offset-1 ring-current`
                        : `border-slate-200 dark:border-slate-700 hover:${c.borderColor} ${c.bgColor} ${c.color}`
                      }
                    `}
                  >
                    <span className={c.color}>{c.icon}</span>
                    <span>{c.label}</span>
                    {c.limitMin && (
                      <span className="text-[10px] opacity-60">{c.description}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Departure button */}
          {!departed && (
            <Button
              variant="outline"
              className="w-full gap-2 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-600 dark:border-red-800 dark:hover:bg-red-950/30"
              onClick={() => handleStatus('DEPART')}
              disabled={loading}
            >
              <LogOut className="w-4 h-4" />
              Enregistrer mon départ
            </Button>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {records.length > 0 && (
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Historique du jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {records.map((r) => {
                const c = STATUS_CONFIG[r.status]
                const isLate =
                  r.durationMin !== null &&
                  c?.limitMin !== null &&
                  r.durationMin > (c?.limitMin ?? Infinity)
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className={c?.color}>{c?.icon}</span>
                      <span className="font-medium">{c?.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatTime(r.startedAt)}
                        {r.endedAt ? ` → ${formatTime(r.endedAt)}` : ' → en cours'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.durationMin !== null && (
                        <span className={`text-xs font-mono ${isLate ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                          {formatMinutes(r.durationMin)}
                          {isLate && ' ⚠️'}
                        </span>
                      )}
                      {!r.endedAt && (
                        <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-0">En cours</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
