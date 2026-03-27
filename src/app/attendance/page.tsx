'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminAttendanceView from '@/components/AdminAttendanceView'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock } from 'lucide-react'
import GaugeChart from '@/components/GaugeChart'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface AttendanceRecord {
  id: string
  userId: string
  status: string
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EN_PRODUCTION: { label: 'Shift',     color: 'text-indigo-700', bg: 'bg-indigo-100' },
  PAUSE:         { label: 'Pause',     color: 'text-amber-700',  bg: 'bg-amber-100' },
  LUNCH:         { label: 'Lunch',     color: 'text-orange-700', bg: 'bg-orange-100' },
  REUNION:       { label: 'Réunion',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  RENCONTRE:     { label: 'Rencontre', color: 'text-purple-700', bg: 'bg-purple-100' },
  FORMATION:     { label: 'Formation', color: 'text-emerald-700',bg: 'bg-emerald-100' },
  ABSENT:        { label: 'Absent',    color: 'text-red-700',    bg: 'bg-red-100' },
  CONGE:         { label: 'Congé',     color: 'text-teal-700',   bg: 'bg-teal-100' },
}

function fmtTime(iso: string): string {
  return new Date(iso + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function todayStr(): string { return new Date().toISOString().split('T')[0] }

// ── Member History Component ─────────────────────────────────────────────────

function MemberHistory({ userId }: { userId: string }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/attendance?userId=${userId}&date=${selectedDate}`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }, [userId, selectedDate])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const totalDuration = records.reduce((acc, r) => acc + (r.durationMin || 0), 0)

  // Calculate percentages for gauge
  const shiftDuration = records.filter(r => r.status === 'EN_PRODUCTION').reduce((acc, r) => acc + (r.durationMin || 0), 0)
  const pauseDuration = records.filter(r => r.status === 'PAUSE').reduce((acc, r) => acc + (r.durationMin || 0), 0)
  const lunchDuration = records.filter(r => r.status === 'LUNCH').reduce((acc, r) => acc + (r.durationMin || 0), 0)
  const otherDuration = totalDuration - shiftDuration - pauseDuration - lunchDuration

  const shiftPercent = totalDuration > 0 ? (shiftDuration / totalDuration) * 100 : 0
  const pausePercent = totalDuration > 0 ? (pauseDuration / totalDuration) * 100 : 0
  const lunchPercent = totalDuration > 0 ? (lunchDuration / totalDuration) * 100 : 0
  const otherPercent = totalDuration > 0 ? (otherDuration / totalDuration) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Date</Label>
        <Input 
          type="date" 
          value={selectedDate} 
          onChange={e => setSelectedDate(e.target.value)} 
          className="w-40"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
          Aucune entrée pour cette date
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
            <span className="text-sm text-muted-foreground">Total du jour</span>
            <span className="font-semibold text-indigo-700">{fmtDur(totalDuration)}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Heure début</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Heure fin</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Durée</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Note</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const cfg = STATUS_CONFIG[r.status]
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge className={`${cfg?.bg} ${cfg?.color} border-0 text-xs`}>
                          {cfg?.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{fmtTime(r.startedAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.endedAt ? fmtTime(r.endedAt) : '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.durationMin ? fmtDur(r.durationMin) : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs italic">{r.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Gauge Chart */}
          {totalDuration > 0 && (
            <Card className="border-2 border-indigo-200 mt-4">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  Répartition du temps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GaugeChart 
                  shiftPercent={shiftPercent}
                  pausePercent={pausePercent}
                  lunchPercent={lunchPercent}
                  otherPercent={otherPercent}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  if (status === 'loading' && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {isAdmin ? "Gestion des présences" : "Mes présences"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Historique, validations et rapports" : "Historique de vos états de présence"}
          </p>
        </div>

        {isAdmin ? (
          <AdminAttendanceView />
        ) : (
          <Card className="border-2 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                Historique de mes présences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user?.id && <MemberHistory userId={user.id} />}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}