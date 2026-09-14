'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, FileText, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface AttendanceRecord {
  id: string
  userId: string
  status: string
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
  user: { id: string; name: string; email: string; jobRole: string | null }
}

interface ReportRow {
  userName: string
  userId: string
  date: string
  totalShift: number
  totalPause: number
  totalLunch: number
  totalOther: number
  breakdown: Record<string, number>
  alerts: string[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EN_PRODUCTION: { label: 'Shift', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  PAUSE: { label: 'Pause', color: 'text-amber-700', bg: 'bg-amber-100' },
  LUNCH: { label: 'Lunch', color: 'text-orange-700', bg: 'bg-orange-100' },
  REUNION: { label: 'Réunion', color: 'text-blue-700', bg: 'bg-blue-100' },
  RENCONTRE: { label: 'Rencontre', color: 'text-purple-700', bg: 'bg-purple-100' },
  FORMATION: { label: 'Formation', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  ABSENT: { label: 'Absent', color: 'text-red-700', bg: 'bg-red-100' },
  CONGE: { label: 'Congé', color: 'text-teal-700', bg: 'bg-teal-100' },
}

function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function todayStr(): string { return new Date().toISOString().split('T')[0] }

function weekRange() {
  const now = new Date(), day = now.getDay() || 7
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] }
}

function monthRange() {
  const now = new Date()
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: now.toISOString().split('T')[0],
  }
}

export default function AttendanceReportPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, router, isDemo, isAdmin])

  // Charger la liste des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users')
        if (res.ok) {
          const data = await res.json()
          const usersList = Array.isArray(data) ? data : data.users || []
          setUsers(usersList.map((u: any) => ({
            id: u.id,
            name: u.name
          })))
        }
      } catch (error) {
        console.error('Error loading users:', error)
      }
    }
    loadUsers()
  }, [])

  const getRange = () => {
    if (period === 'today') return { from: todayStr(), to: todayStr() }
    if (period === 'week') return weekRange()
    if (period === 'month') return monthRange()
    return { from: dateFrom, to: dateTo }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRange()
    try {
      const res = await fetch(`/api/attendance?all=true&dateFrom=${from}&dateTo=${to}`)
      if (res.ok) {
        const data = await res.json()
        setRecords(data)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    }
    setLoading(false)
  }, [period, dateFrom, dateTo])

  useEffect(() => { 
    if (isAdmin) {
      fetchReport() 
    }
  }, [period, isAdmin])

  const buildRows = (): ReportRow[] => {
    const map = new Map<string, AttendanceRecord[]>()
    for (const r of records.filter(r => r.status !== 'SHIFT')) {
      const date = r.startedAt.split('T')[0]
      const key = `${r.userId}__${date}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }

    const rows: ReportRow[] = []
    map.forEach((recs, key) => {
      const [userId, date] = key.split('__')
      const userName = users.find(u => u.id === userId)?.name || userId
      const breakdown: Record<string, number> = {}
      let totalShift = 0, totalPause = 0, totalLunch = 0, totalOther = 0

      for (const r of recs) {
        const dur = r.durationMin || 0
        breakdown[r.status] = (breakdown[r.status] || 0) + dur
        if (r.status === 'EN_PRODUCTION') totalShift += dur
        else if (r.status === 'PAUSE') totalPause += dur
        else if (r.status === 'LUNCH') totalLunch += dur
        else totalOther += dur
      }

      const alerts: string[] = []
      if (totalShift > 0 && totalShift < 450) alerts.push(`Shift court (${fmtDur(totalShift)})`)
      if (totalPause > 30) alerts.push(`Pause dépassée (${fmtDur(totalPause)})`)
      if (totalLunch > 60) alerts.push(`Lunch dépassé (${fmtDur(totalLunch)})`)

      rows.push({ userName, userId, date, totalShift, totalPause, totalLunch, totalOther, breakdown, alerts })
    })

    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName))
  }

  const rows = buildRows()

  const exportCSV = () => {
    const headers = ['Membre', 'Date', 'Shift', 'Pause', 'Lunch', 'Réunion', 'Rencontre', 'Formation', 'Absent', 'Congé', 'Alertes']
    const lines = rows.map(r => [
      r.userName, r.date,
      fmtDur(r.totalShift),
      fmtDur(r.breakdown['PAUSE'] || 0),
      fmtDur(r.breakdown['LUNCH'] || 0),
      fmtDur(r.breakdown['REUNION'] || 0),
      fmtDur(r.breakdown['RENCONTRE'] || 0),
      fmtDur(r.breakdown['FORMATION'] || 0),
      fmtDur(r.breakdown['ABSENT'] || 0),
      fmtDur(r.breakdown['CONGE'] || 0),
      r.alerts.join(' | '),
    ])
    const csv = [headers, ...lines].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const { from, to } = getRange()
    a.href = url
    a.download = `presence-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Rapport CSV téléchargé')
  }

  const copyTable = () => {
    const lines = rows.map(r =>
      `${r.userName}\t${r.date}\t${fmtDur(r.totalShift)}\t${fmtDur(r.totalPause)}\t${fmtDur(r.totalLunch)}\t${r.alerts.join(', ')}`
    )
    navigator.clipboard.writeText(['Membre\tDate\tShift\tPause\tLunch\tAlertes', ...lines].join('\n'))
    toast.success('Tableau copié dans le presse-papier')
  }

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
            Rapport de présence
          </h1>
          <p className="text-muted-foreground">
            Rapports agrégés et statistiques de présence
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              Rapport de présence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-2">
                <Label>Période</Label>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                    <SelectItem value="custom">Personnalisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {period === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Du</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-2">
                    <Label>Au</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
                  </div>
                  <Button onClick={fetchReport} className="bg-indigo-600 text-white hover:bg-indigo-700 mt-6">
                    Chercher
                  </Button>
                </>
              )}

              {rows.length > 0 && (
                <>
                  <Button size="sm" variant="outline" className="gap-1 mt-6" onClick={copyTable}>
                    <FileText className="w-4 h-4" /> Copier
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 mt-6" onClick={exportCSV}>
                    <Download className="w-4 h-4" /> CSV
                  </Button>
                </>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                Aucune donnée pour cette période
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Membre', 'Date', 'Shift', 'Pause', 'Lunch', 'Autres', 'Alertes'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50 ${r.alerts.length > 0 ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 font-medium">{r.userName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs ${r.totalShift >= 450 ? 'text-emerald-600 font-bold' : r.totalShift > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {r.totalShift > 0 ? fmtDur(r.totalShift) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs ${r.totalPause > 30 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                            {r.totalPause > 0 ? fmtDur(r.totalPause) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs ${r.totalLunch > 60 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                            {r.totalLunch > 0 ? fmtDur(r.totalLunch) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.totalOther > 0 ? fmtDur(r.totalOther) : '—'}</td>
                        <td className="px-4 py-3">
                          {r.alerts.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.alerts.map((a, j) => (
                                <span key={j} className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="w-2.5 h-2.5" />{a}
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-xs text-emerald-600">✓ OK</span>}
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