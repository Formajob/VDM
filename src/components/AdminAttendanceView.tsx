'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

import GaugeChart from '@/components/GaugeChart'
import {
  Clock, Coffee, UtensilsCrossed, Users, BookOpen, Handshake,
  UserX, Palmtree, Play, AlertTriangle, Download, RefreshCw,
  LogOut, Plus, Pencil, Trash2, FileText,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'EN_PRODUCTION' | 'PAUSE' | 'LUNCH' | 'REUNION' | 'RENCONTRE' | 'FORMATION' | 'ABSENT' | 'CONGE'
type StatusOrDepart = AttendanceStatus | 'DEPART'

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
  id: string; name: string; email: string; jobRole: string | null
}

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; limitMin: number | null }> = {
  EN_PRODUCTION: { label: 'Shift',     icon: <Play className="w-3 h-3" />,            color: 'text-indigo-700', bg: 'bg-indigo-100', limitMin: 450 },
  PAUSE:         { label: 'Pause',     icon: <Coffee className="w-3 h-3" />,          color: 'text-amber-700',  bg: 'bg-amber-100',  limitMin: 30  },
  LUNCH:         { label: 'Lunch',     icon: <UtensilsCrossed className="w-3 h-3" />, color: 'text-orange-700', bg: 'bg-orange-100', limitMin: 60  },
  REUNION:       { label: 'Réunion',   icon: <Users className="w-3 h-3" />,           color: 'text-blue-700',   bg: 'bg-blue-100',   limitMin: 60  },
  RENCONTRE:     { label: 'Rencontre', icon: <Handshake className="w-3 h-3" />,       color: 'text-purple-700', bg: 'bg-purple-100', limitMin: 60  },
  FORMATION:     { label: 'Formation', icon: <BookOpen className="w-3 h-3" />,        color: 'text-emerald-700',bg: 'bg-emerald-100',limitMin: 60  },
  ABSENT:        { label: 'Absent',    icon: <UserX className="w-3 h-3" />,           color: 'text-red-700',    bg: 'bg-red-100',    limitMin: null },
  CONGE:         { label: 'Congé',     icon: <Palmtree className="w-3 h-3" />,        color: 'text-teal-700',   bg: 'bg-teal-100',   limitMin: null },
  DEPART:        { label: 'Départ',    icon: <LogOut className="w-3 h-3" />,          color: 'text-slate-600',  bg: 'bg-slate-100',  limitMin: null },
}

const MEMBER_STATUSES = Object.keys(STATUS_CONFIG).filter(s => s !== 'DEPART') as AttendanceStatus[]
const ALL_STATUSES_WITH_DEPART = Object.keys(STATUS_CONFIG) as StatusOrDepart[]
const FULLDAY_STATUSES = ['ABSENT', 'CONGE']

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function fmtTime(iso: string): string {
  return new Date(iso + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtElapsed(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.floor((min * 60) % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}m${s.toString().padStart(2, '0')}s` : `${m}m${s.toString().padStart(2, '0')}s`
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

// ── Realtime Tab ─────────────────────────────────────────────────────────────

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
  const [changeStatus, setChangeStatus] = useState<StatusOrDepart>('EN_PRODUCTION')
  const [changing, setChanging] = useState(false)

  const fetchAll = useCallback(async () => {
    const res = await fetch(`/api/attendance?all=true&date=${todayStr()}`)
    if (!res.ok) return
    const records: AttendanceRecord[] = await res.json()

    const byUser = new Map<string, AttendanceRecord[]>()
    for (const r of records) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, [])
      byUser.get(r.userId)!.push(r)
    }

    const now = Date.now()
    // Filter out ADMIN users - they don't clock in/out
    const activeUsers = users.filter(u => {
      const isAdminEmail = u.email?.toLowerCase().includes('admin')
      const isAdminRole = u.jobRole === 'ADMIN'
      return !isAdminEmail && !isAdminRole
    })
    const statuses: MemberStatus[] = activeUsers.map(user => {
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
      if (departed && totalShiftMin > 0 && totalShiftMin < 450) {
        alerts.push(`Départ anticipé (${fmtDur(totalShiftMin)} / 7h30)`)
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
      const isFullDay = FULLDAY_STATUSES.includes(changeStatus)
      const body: any = {
        status: changeStatus,
        targetUserId: changingUser,
        forceStatus: true,
      }
      if (isFullDay) {
        body.fullDay = true
        body.startedAt = todayStr()
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(`Statut mis à jour : ${STATUS_CONFIG[changeStatus]?.label}`)
      setChangingUser(null)
      await fetchAll()
    } catch {
      toast.error('Erreur lors du changement de statut')
    } finally {
      setChanging(false)
    }
  }

  const now = Date.now()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{members.filter(m => m.activeRecord).length} actifs</span>
          <span>{members.filter(m => m.departed).length} partis</span>
          <span className="text-red-600">{members.filter(m => m.alerts.length > 0).length} alertes</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={fetchAll}>
          <RefreshCw className="w-3 h-3" />Actualiser
        </Button>
      </div>
      {lastUpdated && (
        <p className="text-xs text-muted-foreground">Mis à jour à {fmtTime(lastUpdated.toISOString())} · auto 30s</p>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map(m => {
          const cfg = m.activeRecord ? STATUS_CONFIG[m.activeRecord.status] : null
          const elapsed = m.activeRecord
            ? (now - new Date(m.activeRecord.startedAt + 'Z').getTime()) / 60000
            : 0
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
                      <Badge className="bg-slate-100 text-slate-600 border-0 text-xs gap-1">
                        <LogOut className="w-3 h-3" />Parti
                      </Badge>
                    ) : m.activeRecord && cfg ? (
                      <Badge className={`${cfg.bg} ${cfg.color} border-0 text-xs gap-1`}>
                        {cfg.icon}{cfg.label}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Inactif</Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-indigo-50"
                      onClick={() => { setChangingUser(m.user.id); setChangeStatus('EN_PRODUCTION') }}>
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
            <DialogTitle>Changer le statut — {members.find(m => m.user.id === changingUser)?.user.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nouveau statut</Label>
              <Select value={changeStatus} onValueChange={v => setChangeStatus(v as StatusOrDepart)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES_WITH_DEPART.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        {STATUS_CONFIG[s]?.icon}
                        {STATUS_CONFIG[s]?.label}
                        {FULLDAY_STATUSES.includes(s) && (
                          <span className="text-xs text-muted-foreground">(journée complète)</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {FULLDAY_STATUSES.includes(changeStatus) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
                ⚠️ Ceci effacera toutes les entrées du jour et marquera la journée complète (8h-17h).
              </div>
            )}
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

// ── Management Tab ────────────────────────────────────────────────────────────

function ManagementTab({ users }: { users: UserItem[] }) {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [form, setForm] = useState({ status: 'EN_PRODUCTION' as AttendanceStatus, startedAt: '', endedAt: '', note: '' })

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
      const isFullDay = FULLDAY_STATUSES.includes(form.status)
      const body: any = {
        status: form.status,
        targetUserId: selectedUser,
        forceStatus: true,
        note: form.note || null,
      }

      if (isFullDay) {
        body.fullDay = true
        body.startedAt = selectedDate
      } else {
        body.startedAt = `${selectedDate}T${form.startedAt}:00`
        if (form.endedAt) body.endedAt = `${selectedDate}T${form.endedAt}:00`
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Entrée ajoutée')
      setShowAdd(false)
      setForm({ status: 'EN_PRODUCTION', startedAt: '', endedAt: '', note: '' })
      fetchRecords()
    } catch {
      toast.error("Erreur lors de l'ajout")
    }
  }

  const handleEdit = async () => {
    if (!editRecord) return
    try {
      // 1. Supprimer l'ancienne entrée
      await fetch(`/api/attendance/${editRecord.id}`, { method: 'DELETE' })
      
      // 2. Créer la nouvelle entrée avec les données mises à jour
      const isFullDay = FULLDAY_STATUSES.includes(form.status)
      const body: any = {
        status: form.status,
        targetUserId: selectedUser,
        forceStatus: true,
        note: form.note || null,
      }

      if (isFullDay) {
        body.fullDay = true
        body.startedAt = selectedDate
      } else {
        body.startedAt = `${selectedDate}T${form.startedAt}:00`
        if (form.endedAt) body.endedAt = `${selectedDate}T${form.endedAt}:00`
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const isFullDayForm = FULLDAY_STATUSES.includes(form.status)

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Membre</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
            <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
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
              <div key={r.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={`${cfg?.bg} ${cfg?.color} border-0 text-xs gap-1`}>{cfg?.icon}{cfg?.label}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {fmtTime(r.startedAt)}{r.endedAt ? ` → ${fmtTime(r.endedAt)}` : ' → en cours'}
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
            <DialogTitle>Ajouter — {users.find(u => u.id === selectedUser)?.name} — {selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AttendanceStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                      {FULLDAY_STATUSES.includes(s) && ' (journée complète)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isFullDayForm ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
                ⚠️ Toutes les entrées du jour seront supprimées et remplacées par une journée complète (8h-17h).
              </div>
            ) : (
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
            )}
            <div className="space-y-2">
              <Label>Note (optionnel)</Label>
              <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ex: Pause oubliée..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!isFullDayForm && !form.startedAt} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'entrée</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AttendanceStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEMBER_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}</SelectContent>
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

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ users }: { users: UserItem[] }) {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  const fetchRecords = useCallback(async () => {
    if (!selectedUser) return
    setLoading(true)
    const res = await fetch(`/api/attendance?userId=${selectedUser}&date=${selectedDate}`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }, [selectedUser, selectedDate])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedRecords = [...records].sort((a, b) => {
    if (!sortConfig) return 0
    const { key, direction } = sortConfig
    let aVal: any, bVal: any
    
    switch(key) {
      case 'date': aVal = a.startedAt; bVal = b.startedAt; break
      case 'status': aVal = STATUS_CONFIG[a.status]?.label; bVal = STATUS_CONFIG[b.status]?.label; break
      case 'start': aVal = a.startedAt; bVal = b.startedAt; break
      case 'end': aVal = a.endedAt || ''; bVal = b.endedAt || ''; break
      case 'duration': aVal = a.durationMin || 0; bVal = b.durationMin || 0; break
      case 'note': aVal = a.note || ''; bVal = b.note || ''; break
      default: return 0
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1
    if (aVal > bVal) return direction === 'asc' ? 1 : -1
    return 0
  })

  const getAlertForRecord = (r: AttendanceRecord) => {
    const cfg = STATUS_CONFIG[r.status]
    if (!cfg?.limitMin || !r.durationMin) return null
    if (r.durationMin > cfg.limitMin) {
      return `Dépassement +${fmtDur(r.durationMin - cfg.limitMin)}`
    }
    return null
  }

  // Calculate percentages for gauge
  const totalDuration = records.reduce((acc, r) => acc + (r.durationMin || 0), 0)
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
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Membre</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
            <SelectContent>
              {users.filter(u => u.jobRole !== 'ADMIN' && !u.email?.toLowerCase().includes('admin')).map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
          {selectedUser ? 'Aucune entrée pour cette date' : 'Sélectionnez un membre'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'status', label: 'Statut' },
                    { key: 'start', label: 'Heure début' },
                    { key: 'end', label: 'Heure fin' },
                    { key: 'duration', label: 'Durée' },
                    { key: 'alert', label: 'Alerte' },
                    { key: 'note', label: 'Note' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortConfig?.key === col.key && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r, i) => {
                  const cfg = STATUS_CONFIG[r.status]
                  const alert = getAlertForRecord(r)
                  return (
                    <tr key={r.id} className={`border-t border-slate-100 hover:bg-slate-50 ${alert ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-muted-foreground">{r.startedAt.split('T')[0]}</td>
                      <td className="px-4 py-3">
                        <Badge className={`${cfg?.bg} ${cfg?.color} border-0 text-xs gap-1`}>
                          {cfg?.icon}{cfg?.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{fmtTime(r.startedAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.endedAt ? fmtTime(r.endedAt) : '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.durationMin ? fmtDur(r.durationMin) : '—'}</td>
                      <td className="px-4 py-3">
                        {alert ? (
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{alert}
                          </span>
                        ) : <span className="text-xs text-emerald-600">✓</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs italic">{r.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Gauge Chart */}
          {totalDuration > 0 && (
            <Card className="border-2 border-indigo-200">
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

// ── Reports Tab ───────────────────────────────────────────────────────────────

interface ReportRow {
  userName: string; date: string
  totalShift: number; totalPause: number; totalLunch: number; totalOther: number
  breakdown: Record<string, number>; alerts: string[]
}

function ReportsTab({ users }: { users: UserItem[] }) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)

  const getRange = () => {
    if (period === 'today') return { from: todayStr(), to: todayStr() }
    if (period === 'week') return weekRange()
    if (period === 'month') return monthRange()
    return { from: dateFrom, to: dateTo }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRange()
    const res = await fetch(`/api/attendance?all=true&dateFrom=${from}&dateTo=${to}`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }, [period, dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [period])

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
      rows.push({ userName, date, totalShift, totalPause, totalLunch, totalOther, breakdown, alerts })
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
    a.href = url; a.download = `presence-${from}-${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const copyTable = () => {
    const lines = rows.map(r =>
      `${r.userName}\t${r.date}\t${fmtDur(r.totalShift)}\t${fmtDur(r.totalPause)}\t${fmtDur(r.totalLunch)}\t${r.alerts.join(', ')}`
    )
    navigator.clipboard.writeText(['Membre\tDate\tShift\tPause\tLunch\tAlertes', ...lines].join('\n'))
    toast.success('Tableau copié')
  }

  return (
    <div className="space-y-4">
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
            <div className="space-y-1"><Label className="text-xs">Du</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">Au</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
            <Button onClick={fetchReport} className="bg-indigo-600 text-white hover:bg-indigo-700">Chercher</Button>
          </>
        )}
        {rows.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="gap-1" onClick={copyTable}><FileText className="w-3 h-3" />Copier</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportCSV}><Download className="w-3 h-3" />CSV</Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">Aucune donnée pour cette période</div>
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
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminAttendanceView({ showOnlyRealtime = false }: { showOnlyRealtime?: boolean }) {
  const [users, setUsers] = useState<UserItem[]>([])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      setUsers(data.map((u: any) => ({ id: u.id, name: u.name, email: u.email, jobRole: u.jobRole || null })))
    })
  }, [])

  return (
    <div className="space-y-4">
      {!showOnlyRealtime && (
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-500" />Gestion des présences
        </h2>
      )}
      {showOnlyRealtime ? (
        <RealtimeTab users={users} />
      ) : (
        <Tabs defaultValue="history">
          <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100">
            <TabsTrigger value="history" className="data-[state=active]:bg-white">Historique</TabsTrigger>
            <TabsTrigger value="manage" className="data-[state=active]:bg-white">Gestion</TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-white">Rapports</TabsTrigger>
          </TabsList>
          <TabsContent value="history" className="mt-4"><HistoryTab users={users} /></TabsContent>
          <TabsContent value="manage" className="mt-4"><ManagementTab users={users} /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportsTab users={users} /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}