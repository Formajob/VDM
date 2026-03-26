'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Clock, Coffee, UtensilsCrossed, Users, BookOpen, Handshake,
  UserX, Palmtree, Play, AlertTriangle, Download, RefreshCw,
  LogOut, Plus, Pencil, Trash2, FileText,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type AttendanceStatus = 'EN_PRODUCTION' | 'PAUSE' | 'LUNCH' | 'REUNION' | 'RENCONTRE' | 'FORMATION' | 'ABSENT' | 'CONGE'

interface AttendanceRecord {
  id: string
  userId: string
  status: AttendanceStatus
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
  user: { id: string; name: string; email: string; jobRole: string | null }
}

interface UserItem {
  id: string
  name: string
  email: string
  jobRole: string | null
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; limitMin: number | null }> = {
  EN_PRODUCTION: { label: 'Shift',     icon: <Play className="w-3 h-3" />,             color: 'text-indigo-700', bg: 'bg-indigo-100', limitMin: 450 },
  PAUSE:         { label: 'Pause',     icon: <Coffee className="w-3 h-3" />,           color: 'text-amber-700',  bg: 'bg-amber-100',  limitMin: 30  },
  LUNCH:         { label: 'Lunch',     icon: <UtensilsCrossed className="w-3 h-3" />,  color: 'text-orange-700', bg: 'bg-orange-100', limitMin: 60  },
  REUNION:       { label: 'Réunion',   icon: <Users className="w-3 h-3" />,            color: 'text-blue-700',   bg: 'bg-blue-100',   limitMin: 60  },
  RENCONTRE:     { label: 'Rencontre', icon: <Handshake className="w-3 h-3" />,        color: 'text-purple-700', bg: 'bg-purple-100', limitMin: 60  },
  FORMATION:     { label: 'Formation', icon: <BookOpen className="w-3 h-3" />,         color: 'text-emerald-700',bg: 'bg-emerald-100',limitMin: 60  },
  ABSENT:        { label: 'Absent',    icon: <UserX className="w-3 h-3" />,            color: 'text-red-700',    bg: 'bg-red-100',    limitMin: null },
  CONGE:         { label: 'Congé',     icon: <Palmtree className="w-3 h-3" />,         color: 'text-teal-700',   bg: 'bg-teal-100',   limitMin: null },
}

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as AttendanceStatus[]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${m}min`
}

function fmtTime(iso: string): string {
  return new Date(iso + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtElapsed(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.floor((min * 60) % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2,'0')}m${s.toString().padStart(2,'0')}s` : `${m}m${s.toString().padStart(2,'0')}s`
}

function today(): string { return new Date().toISOString().split('T')[0] }

function weekRange(): { from: string; to: string } {
  const now = new Date()
  const day = now.getDay() || 7
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] }
}

function monthRange(): { from: string; to: string } {
  const now = new Date()
  return {
    from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,
    to: now.toISOString().split('T')[0],
  }
}

// ─── Realtime tab ────────────────────────────────────────────────────────────

interface MemberStatus {
  user: UserItem
  activeRecord: AttendanceRecord | null
  totalShiftMin: number
  departed: boolean
  alerts: string[]
}

function RealtimeTab({ users }: { users: UserItem[] }) {
  const [members, setMembers] = useState<MemberStatus[]>([])
  const [tick, setTick] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [changingUser, setChangingUser] = useState<string | null>(null)
  const [changeStatus, setChangeStatus] = useState<AttendanceStatus>('EN_PRODUCTION')
  const [changing, setChanging] = useState(false)

  const fetchAll = useCallback(async () => {
    const res = await fetch(`/api/attendance?all=true&date=${today()}`)
    if (!res.ok) return
    const records: AttendanceRecord[] = await res.json()

    const byUser = new Map<string, AttendanceRecord[]>()
    for (const r of records) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, [])
      byUser.get(r.userId)!.push(r)
    }

    const now = Date.now()
    const statuses: MemberStatus[] = users.map(user => {
      const recs = byUser.get(user.id) || []
      const active = recs.find(r => !r.endedAt) || null
      const departed = !active && recs.length > 0

      const totalShiftMin = recs
        .filter(r => r.status === 'EN_PRODUCTION')
        .reduce((acc, r) => {
          if (r.durationMin) return acc + r.durationMin
          if (!r.endedAt) return acc + (now - new Date(r.startedAt + 'Z').getTime()) / 60000
          return acc
        }, 0)

      const alerts: string[] = []
      if (active) {
        const cfg = STATUS_CONFIG[active.status]
        const elapsed = (now - new Date(active.startedAt + 'Z').getTime()) / 60000
        if (cfg?.limitMin && elapsed > cfg.limitMin) {
          alerts.push(`Dépassement ${cfg.label} +${fmtDur(elapsed - cfg.limitMin)}`)
        }
      }
      if (departed && totalShiftMin < 450) {
        alerts.push(`Départ anticipé (${fmtDur(totalShiftMin)} / 7h30)`)
      }
      if (!active && !departed && recs.length === 0) {
        alerts.push('Absent non signalé')
      }

      return { user, activeRecord: active, totalShiftMin, departed, alerts }
    })

    setMembers(statuses)
    setLastUpdated(new Date())
  }, [users])

  useEffect(() => {
    fetchAll()
    const iv = setInterval(fetchAll, 30000)
    return () => clearInterval(iv)
  }, [fetchAll])

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const handleForceStatus = async () => {
    if (!changingUser) return
    setChanging(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: changeStatus, targetUserId: changingUser, startedAt: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Statut modifié')
      setChangingUser(null)
      fetchAll()
    } catch {
      toast.error('Erreur lors du changement de statut')
    } finally {
      setChanging(false)
    }
  }

  const now = Date.now()
  const activeCount = members.filter(m => m.activeRecord).length
  const alertCount = members.filter(m => m.alerts.length > 0).length
  const departedCount = members.filter(m => m.departed).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />{activeCount} actifs</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />{departedCount} partis</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{alertCount} alertes</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={fetchAll}>
            <RefreshCw className="w-3 h-3" />Actualiser
          </Button>
        </div>
      </div>
      {lastUpdated && <p className="text-xs text-muted-foreground">Mis à jour à {fmtTime(lastUpdated.toISOString())} · auto 30s</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map(m => {
          const cfg = m.activeRecord ? STATUS_CONFIG[m.activeRecord.status] : null
          const elapsed = m.activeRecord ? (now - new Date(m.activeRecord.startedAt + 'Z').getTime()) / 60000 : 0
          const isOvertime = cfg?.limitMin && elapsed > cfg.limitMin

          return (
            <Card key={m.user.id} className={`border-2 transition-all ${m.alerts.length > 0 ? 'border-red-300' : m.activeRecord ? 'border-indigo-200' : 'border-slate-200'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground">{m.user.jobRole || m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.departed ? (
                      <Badge className="bg-slate-100 text-slate-600 border-0 text-xs gap-1"><LogOut className="w-3 h-3" />Parti</Badge>
                    ) : m.activeRecord && cfg ? (
                      <Badge className={`${cfg.bg} ${cfg.color} border-0 text-xs gap-1`}>{cfg.icon}{cfg.label}</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Inactif</Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setChangingUser(m.user.id)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {m.activeRecord && cfg && (
                  <div className={`rounded-lg p-2 ${cfg.bg} flex justify-between items-center`}>
                    <span className={`text-xs ${cfg.color}`}>Depuis {fmtTime(m.activeRecord.startedAt)}</span>
                    <span className={`text-sm font-mono font-bold ${isOvertime ? 'text-red-600' : cfg.color}`}>
                      {fmtElapsed(elapsed)}{isOvertime && ' ⚠️'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Shift total</span>
                  <span className={`font-semibold ${m.totalShiftMin >= 450 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {m.totalShiftMin > 0 ? fmtDur(m.totalShiftMin) : '—'}
                  </span>
                </div>
                {m.alerts.map((a, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />{a}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Force status dialog */}
      <Dialog open={!!changingUser} onOpenChange={() => setChangingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut en temps réel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Membre</Label>
              <p className="text-sm font-medium">{members.find(m => m.user.id === changingUser)?.user.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Nouveau statut</Label>
              <Select value={changeStatus} onValueChange={(v) => setChangeStatus(v as AttendanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangingUser(null)}>Annuler</Button>
            <Button onClick={handleForceStatus} disabled={changing} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Management tab ──────────────────────────────────────────────────────────

function ManagementTab({ users }: { users: UserItem[] }) {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(today())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)

  const [form, setForm] = useState({
    status: 'EN_PRODUCTION' as AttendanceStatus,
    startedAt: '',
    endedAt: '',
    note: '',
  })

  const fetchRecords = useCallback(async () => {
    if (!selectedUser) return
    setLoading(true)
    const res = await fetch(`/api/attendance?userId=${selectedUser}&date=${selectedDate}`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }, [selectedUser, selectedDate])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleAdd = async () => {
    try {
      const startIso = `${selectedDate}T${form.startedAt}:00`
      const endIso = form.endedAt ? `${selectedDate}T${form.endedAt}:00` : null

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: form.status,
          targetUserId: selectedUser,
          startedAt: startIso,
          endedAt: endIso,
          note: form.note || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Entrée ajoutée')
      setShowAdd(false)
      setForm({ status: 'EN_PRODUCTION', startedAt: '', endedAt: '', note: '' })
      fetchRecords()
    } catch {
      toast.error('Erreur lors de l\'ajout')
    }
  }

  const handleEdit = async () => {
    if (!editRecord) return
    try {
      const startIso = `${selectedDate}T${form.startedAt}:00`
      const endIso = form.endedAt ? `${selectedDate}T${form.endedAt}:00` : null

      const res = await fetch(`/api/attendance/${editRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: form.status,
          startedAt: startIso,
          endedAt: endIso,
          note: form.note || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Entrée modifiée')
      setEditRecord(null)
      fetchRecords()
    } catch {
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return
    const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Supprimé'); fetchRecords() }
    else toast.error('Erreur lors de la suppression')
  }

  const openEdit = (r: AttendanceRecord) => {
    setEditRecord(r)
    setForm({
      status: r.status,
      startedAt: new Date(r.startedAt + 'Z').toTimeString().slice(0, 5),
      endedAt: r.endedAt ? new Date(r.endedAt + 'Z').toTimeString().slice(0, 5) : '',
      note: r.note || '',
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Membre</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
            <SelectContent>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700 w-full"
            onClick={() => { setShowAdd(true); setForm({ status: 'EN_PRODUCTION', startedAt: '', endedAt: '', note: '' }) }}
            disabled={!selectedUser}
          >
            <Plus className="w-4 h-4" />Ajouter une entrée
          </Button>
        </div>
      </div>

      {/* Records */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
          {selectedUser ? 'Aucune entrée pour cette date' : 'Sélectionnez un membre'}
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const cfg = STATUS_CONFIG[r.status]
            return (
              <div key={r.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <Badge className={`${cfg?.bg} ${cfg?.color} border-0 text-xs gap-1`}>{cfg?.icon}{cfg?.label}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {fmtTime(r.startedAt)}
                    {r.endedAt ? ` → ${fmtTime(r.endedAt)}` : ' → en cours'}
                  </span>
                  {r.durationMin !== null && (
                    <span className="text-xs font-mono text-slate-500">{fmtDur(r.durationMin)}</span>
                  )}
                  {r.note && <span className="text-xs text-muted-foreground italic">"{r.note}"</span>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-red-600" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une entrée — {users.find(u => u.id === selectedUser)?.name} — {selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AttendanceStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure début</Label>
                <Input type="time" value={form.startedAt} onChange={e => setForm({ ...form, startedAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Heure fin (optionnel)</Label>
                <Input type="time" value={form.endedAt} onChange={e => setForm({ ...form, endedAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (optionnel)</Label>
              <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ex: Pause oubliée..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!form.startedAt} className="bg-indigo-600 text-white hover:bg-indigo-700">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'entrée</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AttendanceStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure début</Label>
                <Input type="time" value={form.startedAt} onChange={e => setForm({ ...form, startedAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Heure fin</Label>
                <Input type="time" value={form.endedAt} onChange={e => setForm({ ...form, endedAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Annuler</Button>
            <Button onClick={handleEdit} className="bg-indigo-600 text-white hover:bg-indigo-700">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Reports tab ─────────────────────────────────────────────────────────────

interface ReportRow {
  userName: string
  date: string
  statusBreakdown: Record<string, number>
  totalShift: number
  totalPause: number
  totalLunch: number
  totalOther: number
  alerts: string[]
}

function ReportsTab({ users }: { users: UserItem[] }) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)

  const getRange = () => {
    if (period === 'today') return { from: today(), to: today() }
    if (period === 'week') return weekRange()
    if (period === 'month') return monthRange()
    return { from: dateFrom, to: dateTo }
  }

  const fetchReport = async () => {
    setLoading(true)
    const { from, to } = getRange()
    const res = await fetch(`/api/attendance?all=true&dateFrom=${from}&dateTo=${to}`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchReport() }, [period])

  // Build report rows grouped by user + date
  const buildRows = (): ReportRow[] => {
    const map = new Map<string, AttendanceRecord[]>()
    for (const r of records) {
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

      rows.push({ userName, date, statusBreakdown: breakdown, totalShift, totalPause, totalLunch, totalOther, alerts })
    })

    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName))
  }

  const rows = buildRows()

  const exportCSV = () => {
    const headers = ['Membre', 'Date', 'Shift', 'Pause', 'Lunch', 'Réunion', 'Rencontre', 'Formation', 'Absent', 'Congé', 'Alertes']
    const lines = rows.map(r => [
      r.userName,
      r.date,
      fmtDur(r.totalShift),
      fmtDur(r.statusBreakdown['PAUSE'] || 0),
      fmtDur(r.statusBreakdown['LUNCH'] || 0),
      fmtDur(r.statusBreakdown['REUNION'] || 0),
      fmtDur(r.statusBreakdown['RENCONTRE'] || 0),
      fmtDur(r.statusBreakdown['FORMATION'] || 0),
      fmtDur(r.statusBreakdown['ABSENT'] || 0),
      fmtDur(r.statusBreakdown['CONGE'] || 0),
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
  }

  const copyTable = () => {
    const lines = rows.map(r =>
      `${r.userName}\t${r.date}\t${fmtDur(r.totalShift)}\t${fmtDur(r.statusBreakdown['PAUSE']||0)}\t${fmtDur(r.statusBreakdown['LUNCH']||0)}\t${r.alerts.join(', ')}`
    )
    navigator.clipboard.writeText(['Membre\tDate\tShift\tPause\tLunch\tAlertes', ...lines].join('\n'))
    toast.success('Tableau copié dans le presse-papiers')
  }

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Période</Label>
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
            <div className="space-y-1">
              <Label className="text-xs">Du</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Au</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={fetchReport} className="bg-indigo-600 text-white hover:bg-indigo-700">Chercher</Button>
          </>
        )}
        {rows.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="gap-1" onClick={copyTable}>
              <FileText className="w-3 h-3" />Copier
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportCSV}>
              <Download className="w-3 h-3" />CSV
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">Aucune donnée pour cette période</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Membre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shift</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pause</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lunch</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Autres</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alertes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${r.alerts.length > 0 ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
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
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {r.totalOther > 0 ? fmtDur(r.totalOther) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.alerts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.alerts.map((a, j) => (
                          <span key={j} className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-2.5 h-2.5" />{a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-600">✓ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminAttendanceView() {
  const [users, setUsers] = useState<UserItem[]>([])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      setUsers(data.map((u: any) => ({ id: u.id, name: u.name, email: u.email, jobRole: u.jobRole || null })))
    })
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Clock className="h-5 w-5 text-indigo-500" />
        Gestion des présences
      </h2>

      <Tabs defaultValue="realtime">
        <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
          <TabsTrigger value="realtime" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
            Temps réel
          </TabsTrigger>
          <TabsTrigger value="manage" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
            Gestion
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
            Rapports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="mt-4">
          <RealtimeTab users={users} />
        </TabsContent>
        <TabsContent value="manage" className="mt-4">
          <ManagementTab users={users} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab users={users} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
