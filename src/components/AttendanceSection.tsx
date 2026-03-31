'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Clock, Coffee, UtensilsCrossed, Users, BookOpen,
  Handshake, UserX, Palmtree, LogOut, Play, AlertTriangle,
} from 'lucide-react'

type AttendanceStatus =
  | 'EN_PRODUCTION' | 'PAUSE' | 'LUNCH' | 'REUNION'
  | 'RENCONTRE' | 'FORMATION' | 'ABSENT' | 'CONGE'

interface AttendanceRecord {
  id: string; userId: string; status: AttendanceStatus
  startedAt: string; endedAt: string | null
  durationMin: number | null; note: string | null
}

interface StatusConfig {
  label: string; icon: React.ReactNode
  color: string; bgColor: string; borderColor: string
  limitMin: number | null; description: string
}

const STATUS_CONFIG: Record<AttendanceStatus, StatusConfig> = {
  EN_PRODUCTION: { label: 'Shift',     icon: <Play className="w-4 h-4" />,            color: 'text-indigo-600', bgColor: 'bg-indigo-50',  borderColor: 'border-indigo-300', limitMin: 450, description: '7h30 minimum' },
  PAUSE:         { label: 'Pause',     icon: <Coffee className="w-4 h-4" />,          color: 'text-amber-600',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-300',  limitMin: 30,  description: '30 min max' },
  LUNCH:         { label: 'Lunch',     icon: <UtensilsCrossed className="w-4 h-4" />, color: 'text-orange-600', bgColor: 'bg-orange-50',  borderColor: 'border-orange-300', limitMin: 60,  description: '60 min max' },
  REUNION:       { label: 'Réunion',   icon: <Users className="w-4 h-4" />,           color: 'text-blue-600',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-300',   limitMin: 60,  description: '60 min' },
  RENCONTRE:     { label: 'Rencontre', icon: <Handshake className="w-4 h-4" />,       color: 'text-purple-600', bgColor: 'bg-purple-50',  borderColor: 'border-purple-300', limitMin: 60,  description: '60 min' },
  FORMATION:     { label: 'Formation', icon: <BookOpen className="w-4 h-4" />,        color: 'text-emerald-600',bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300',limitMin: 60,  description: '60 min' },
  ABSENT:        { label: 'Absent',    icon: <UserX className="w-4 h-4" />,           color: 'text-red-600',    bgColor: 'bg-red-50',     borderColor: 'border-red-300',    limitMin: null,description: 'Sans limite' },
  CONGE:         { label: 'Congé',     icon: <Palmtree className="w-4 h-4" />,        color: 'text-teal-600',   bgColor: 'bg-teal-50',    borderColor: 'border-teal-300',   limitMin: null,description: 'Sans limite' },
}

const FULLDAY_STATUSES: AttendanceStatus[] = ['ABSENT', 'CONGE']
const MEMBER_SELECTABLE_STATUSES: AttendanceStatus[] = [
  'EN_PRODUCTION', 'PAUSE', 'LUNCH', 'REUNION', 'RENCONTRE', 'FORMATION'
]

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.floor(minutes % 60), s = Math.floor((minutes * 60) % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2,'0')}m${s.toString().padStart(2,'0')}s` : `${m}m${s.toString().padStart(2,'0')}s`
}

function formatTime(iso: string): string {
  return new Date(iso + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatMinutes(min: number | null): string {
  if (min === null) return '—'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${m}min`
}

export default function AttendanceSection({ userId }: { userId: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [departed, setDeparted] = useState(false)
  const [isFullDayLocked, setIsFullDayLocked] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const fetchRecords = useCallback(async () => {
    try {
      // ✅ CORRECTION CRITIQUE : Ajouter userId pour filtrer les records
      const res = await fetch(`/api/attendance?date=${today}&userId=${userId}`)
      if (!res.ok) return
      const data: AttendanceRecord[] = await res.json()
      setRecords(data)

      const active = data.find(r => !r.endedAt) || null
      setActiveRecord(active)

      const hasFullDay = data.some(r => FULLDAY_STATUSES.includes(r.status))
      setIsFullDayLocked(hasFullDay)

      const hasDeparted = data.length > 0 && !active && !hasFullDay && data.some(r => r.endedAt)
      setDeparted(hasDeparted)
    } catch (error) {
      console.error('Error fetching attendance:', error)
    }
  }, [today, userId])  // ✅ Ajouter userId dans les dépendances

  // ✅ POLLING toutes les 5 secondes
  useEffect(() => {
    fetchRecords()
    const iv = setInterval(fetchRecords, 5000)
    return () => clearInterval(iv)
  }, [fetchRecords])

  useEffect(() => {
    if (!activeRecord) { setElapsed(0); return }
    // ✅ AJOUTER 'Z' pour forcer UTC dans le calcul du timer
    const start = new Date(activeRecord.startedAt + 'Z')
    const update = () => {
      const diff = (Date.now() - start.getTime()) / 60000
      setElapsed(diff > 0 ? diff : 0)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [activeRecord])

  // ✅ CORRECTION PRINCIPALE : Gestion correcte du départ
  const handleStatus = async (status: AttendanceStatus | 'DEPART') => {
    setLoading(true)
    try {
      // ✅ CAS SPÉCIAL: DÉPART → Fermer le record actif
      if (status === 'DEPART') {
        if (!activeRecord) {
          toast.error('Aucun shift actif à fermer')
          setLoading(false)
          return
        }
        
        const now = new Date()
        // ✅ AJOUTER 'Z' pour forcer UTC dans le calcul de durée
        const started = new Date(activeRecord.startedAt + 'Z')
        const durationMin = Math.max(0, Math.round((now.getTime() - started.getTime()) / 60000))
        
        // ✅ Mettre à jour le record actif (pas créer un nouveau)
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeRecord.id,        // ✅ ID du record à fermer
            endedAt: now.toISOString(), // ✅ Heure de fin
            durationMin: durationMin,   // ✅ Durée calculée
          }),
        })
        
        if (!res.ok) throw new Error()
        toast.success('Bonne fin de journée ! Départ enregistré.')
        await fetchRecords()
        setLoading(false)
        return
      }
      
      // ✅ CAS NORMAL: Changement de statut → L'API ferme l'ancien automatiquement
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          status,
        }),
      })
      
      if (!res.ok) throw new Error()
      toast.success(`Statut : ${STATUS_CONFIG[status as AttendanceStatus]?.label}`)
      await fetchRecords()
    } catch {
      toast.error('Erreur lors du changement de statut')
    } finally {
      setLoading(false)
    }
  }

  const isOvertime = activeRecord &&
    STATUS_CONFIG[activeRecord.status]?.limitMin !== null &&
    elapsed > (STATUS_CONFIG[activeRecord.status]?.limitMin ?? Infinity)

  const totalShiftMin = records
    .filter(r => r.status === 'EN_PRODUCTION')
    .reduce((acc, r) => {
      if (r.durationMin) return acc + r.durationMin
      if (!r.endedAt && activeRecord?.id === r.id) return acc + elapsed
      return acc
    }, 0)

  const cfg = activeRecord ? STATUS_CONFIG[activeRecord.status] : null
  const fullDayRecord = records.find(r => FULLDAY_STATUSES.includes(r.status))
  const fullDayCfg = fullDayRecord ? STATUS_CONFIG[fullDayRecord.status] : null

  return (
    <div className="space-y-4">
      <Card className={`border-2 transition-all ${activeRecord ? `${cfg?.borderColor} shadow-lg` : 'border-slate-200 dark:border-slate-700'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />Présence du jour
            </span>
            {totalShiftMin > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Shift total : <span className="font-semibold text-indigo-600">{formatMinutes(totalShiftMin)}</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {isFullDayLocked && fullDayRecord && fullDayCfg ? (
            <div className={`rounded-xl p-4 ${fullDayCfg.bgColor} border ${fullDayCfg.borderColor}`}>
              <div className="flex items-center gap-3">
                <span className={fullDayCfg.color}>{fullDayCfg.icon}</span>
                <div>
                  <p className={`font-semibold ${fullDayCfg.color}`}>{fullDayCfg.label} — Journée complète</p>
                  <p className="text-xs text-muted-foreground">{fullDayRecord.note || "Enregistré par l'administration"}</p>
                </div>
              </div>
            </div>

          ) : activeRecord && cfg ? (
            <div className={`rounded-xl p-4 ${cfg.bgColor} border ${cfg.borderColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cfg.color}>{cfg.icon}</div>
                  <div>
                    <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">Depuis {formatTime(activeRecord.startedAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-mono font-bold ${isOvertime ? 'text-red-600' : cfg.color}`}>
                    {formatDuration(elapsed)}
                  </p>
                  {cfg.limitMin && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
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
            <div className="rounded-xl p-4 bg-slate-50 border border-slate-200 text-center">
              <LogOut className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">Départ enregistré</p>
              <p className="text-xs text-muted-foreground">Bonne fin de journée !</p>
            </div>

          ) : records.length === 0 ? (
            <div className="rounded-xl p-4 bg-slate-50 border-2 border-dashed border-slate-300 text-center">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">Aucun pointage aujourd'hui</p>
              <p className="text-xs text-muted-foreground">Cliquez sur "Shift" pour commencer votre journée</p>
            </div>

          ) : (
            <div className="rounded-xl p-4 bg-slate-50 border border-dashed border-slate-300 text-center">
              <p className="text-sm text-muted-foreground">Aucun statut actif — sélectionnez un statut ci-dessous</p>
            </div>
          )}

          {/* BOUTONS DE CLOCK IN/OUT */}
          {!departed && !isFullDayLocked && (
            <>
              {/* Si aucun pointage, afficher un gros bouton "Commencer le shift" */}
              {records.length === 0 ? (
                <div className="mt-4">
                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 py-6 text-lg font-semibold"
                    onClick={() => handleStatus('EN_PRODUCTION')}
                    disabled={loading}
                  >
                    <Play className="w-5 h-5" />Commencer mon shift
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    Cliquez pour enregistrer le début de votre journée (08:00-17:00 par défaut)
                  </p>
                </div>
              ) : (
                /* Sinon afficher les boutons de changement de statut */
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {MEMBER_SELECTABLE_STATUSES.map(status => {
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
                              ? `${c.borderColor} ${c.bgColor} ${c.color} ring-2 ring-offset-1`
                              : `border-slate-200 ${c.bgColor} ${c.color}`
                            }
                          `}
                        >
                          <span className={c.color}>{c.icon}</span>
                          <span>{c.label}</span>
                          {c.limitMin && <span className="text-[10px] opacity-60">{c.description}</span>}
                        </button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-600"
                    onClick={() => handleStatus('DEPART')}
                    disabled={loading}
                  >
                    <LogOut className="w-4 h-4" />Enregistrer mon départ
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}