'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Calendar, Users, Repeat, Palmtree, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface PlanningDayRaw {
  startTime?: string
  endTime?: string
  shiftType?: 'NORMAL' | 'NIGHT' | 'OFF' | 'VAC'
  isOff?: boolean
}

interface WeeklyPlanning {
  id: string
  userid: string
  weekstart: string
  weekend: string
  monday: PlanningDayRaw | null
  tuesday: PlanningDayRaw | null
  wednesday: PlanningDayRaw | null
  thursday: PlanningDayRaw | null
  friday: PlanningDayRaw | null
  saturday: PlanningDayRaw | null
  sunday: PlanningDayRaw | null
  user?: { name: string; email: string }
}

interface LeaveBalance {
  annualdays: number
  exceptionaldays: number
  sickdays: number
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS: Record<string, string> = {
  sunday: 'Dim', monday: 'Lun', tuesday: 'Mar',
  wednesday: 'Mer', thursday: 'Jeu', friday: 'Ven', saturday: 'Sam'
}

// ✅ CORRECTION : Retourne juste les strings start/end (références stables)
function getWeekRange(date: Date) {
  const day = date.getDay()
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - day)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  return {
    start: sunday.toISOString().split('T')[0],
    end: saturday.toISOString().split('T')[0]
  }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekEnd + 'T00:00:00')
  const startDay = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const endDay = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startDay} - ${endDay}`
}

function PlanningTable({ planning, compact = false }: { planning: WeeklyPlanning; compact?: boolean }) {
  const renderDay = (day: string) => {
    const dayData = planning[day as keyof WeeklyPlanning] as PlanningDayRaw | null
    
    if (!dayData || !dayData.startTime || dayData.shiftType === 'OFF' || dayData.shiftType === 'VAC') {
      const label = dayData?.shiftType === 'VAC' ? 'VAC' : 'OFF'
      const colorClass = dayData?.shiftType === 'VAC' ? 'text-yellow-600 bg-yellow-50' : 'text-slate-500 bg-slate-50'
      return (
        <div className={`text-center py-2 rounded text-xs font-medium ${colorClass}`}>{label}</div>
      )
    }
    
    const shiftLabel = `${dayData.startTime}-${dayData.endTime}`
    const isNight = dayData.shiftType === 'NIGHT'
    
    return (
      <div className="text-center py-2">
        <div className={`flex flex-col items-center gap-1 ${isNight ? 'text-purple-600' : 'text-indigo-600'}`}>
          <Clock className="w-3 h-3" />
          <span className="font-medium text-sm">{shiftLabel}</span>
          {isNight && <span className="text-[10px] text-purple-500">Nuit</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {DAYS.map(day => (
              <th key={day} className="text-center px-2 py-3 font-medium text-muted-foreground text-xs">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            {DAYS.map(day => (
              <td key={day} className="px-2 py-3 border-r last:border-0">
                {renderDay(day)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function PlanningPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  // ✅ CORRECTION : États strings stables au lieu d'objet + ref pour éviter boucle
  const [weekStart, setWeekStart] = useState(() => getWeekRange(new Date()).start)
  const [weekEnd, setWeekEnd] = useState(() => getWeekRange(new Date()).end)
  
  const [planning, setPlanning] = useState<WeeklyPlanning | null>(null)
  const [teamPlanning, setTeamPlanning] = useState<WeeklyPlanning[]>([])
  const [showTeam, setShowTeam] = useState(false)
  const [loading, setLoading] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  
  const [showSwap, setShowSwap] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [swapTarget, setSwapTarget] = useState('')
  const [leaveType, setLeaveType] = useState('ANNUEL')
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([])
  
  // ✅ CORRECTION : Ref pour tracker la dernière semaine fetchée et éviter doublons
  const lastFetchedWeek = useRef<string>('')
  const lastFetchedTeamWeek = useRef<string>('')

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  // ✅ CORRECTION : Dépendances stables + garde-fou avec ref
  const fetchPlanning = useCallback(async () => {
    if (!user?.id) return
    const fetchKey = `my_${weekStart}`
    if (lastFetchedWeek.current === fetchKey) return
    
    lastFetchedWeek.current = fetchKey
    
    setLoading(true)
    
    const res = await fetch(`/api/planning?userId=${user.id}&weekStart=${weekStart}`)
    if (res.ok) {
      const data = await res.json()
      setPlanning(data)
    }
    
    const balanceRes = await fetch(`/api/leave-balance?userId=${user.id}`)
    if (balanceRes.ok) {
      const balance = await balanceRes.json()
      setLeaveBalance(balance)
    }
    
    const membersRes = await fetch('/api/users')
    if (membersRes.ok) {
      const members = await membersRes.json()
      setTeamMembers(members.filter((m: any) => m.id !== user.id && m.role !== 'ADMIN'))
    }
    
    setLoading(false)
  }, [user?.id, weekStart])

  // ✅ CORRECTION : Dépendances stables + garde-fou avec ref
  const fetchTeamPlanning = useCallback(async () => {
    if (!user?.id) return
    const fetchKey = `team_${weekStart}`
    if (lastFetchedTeamWeek.current === fetchKey) return
    
    lastFetchedTeamWeek.current = fetchKey
    
    setLoading(true)
    const res = await fetch(`/api/planning?weekStart=${weekStart}&all=true`)
    if (res.ok) {
      const data = await res.json()
      setTeamPlanning(data)
    }
    setLoading(false)
  }, [user?.id, weekStart])

  // ✅ CORRECTION : useEffect avec dépendances stables uniquement
  useEffect(() => {
    if (showTeam) {
      fetchTeamPlanning()
    } else {
      fetchPlanning()
    }
  }, [weekStart, showTeam])

  // ✅ CORRECTION : Handlers avec comparaison avant setState
  const handlePrevWeek = () => {
    const current = new Date(weekStart + 'T00:00:00')
    current.setDate(current.getDate() - 7)
    const { start, end } = getWeekRange(current)
    if (start !== weekStart) {
      setWeekStart(start)
      setWeekEnd(end)
    }
  }

  const handleNextWeek = () => {
    const current = new Date(weekStart + 'T00:00:00')
    current.setDate(current.getDate() + 7)
    const { start, end } = getWeekRange(current)
    if (start !== weekStart) {
      setWeekStart(start)
      setWeekEnd(end)
    }
  }

  const handleSwapRequest = async () => {
    if (!swapTarget || !user?.id) return
    try {
      const res = await fetch('/api/swap-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.id,
          targetUserId: swapTarget,
          weekStart,
          weekEnd,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Demande d\'échange envoyée')
      setShowSwap(false)
      setSwapTarget('')
    } catch {
      toast.error('Erreur lors de la demande')
    }
  }

  const handleLeaveRequest = async () => {
    if (!user?.id || !leaveStart || !leaveEnd) return
    try {
      const res = await fetch('/api/leave-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          startDate: leaveStart,
          endDate: leaveEnd,
          type: leaveType,
          reason: leaveReason,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Demande de congé envoyée')
      setShowLeave(false)
      setLeaveReason('')
      setLeaveStart('')
      setLeaveEnd('')
    } catch {
      toast.error('Erreur lors de la demande')
    }
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Mon Planning
            </h1>
            <p className="text-muted-foreground">Consultez et gérez votre emploi du temps</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => router.push('/planning/requests')}>
              <Repeat className="w-4 h-4" />Mes demandes
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowSwap(true)}>
              <Repeat className="w-4 h-4" />Demander Swap
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowLeave(true)}>
              <Palmtree className="w-4 h-4" />Demander Congé
            </Button>
          </div>
        </div>

        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="font-semibold text-lg">{formatWeekRange(weekStart, weekEnd)}</p>
                <p className="text-sm text-muted-foreground">Semaine du dimanche au samedi</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleNextWeek}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={showTeam ? 'team' : 'my'} onValueChange={(v) => {
          setShowTeam(v === 'team')
        }}>
          <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100">
            <TabsTrigger value="my" className="data-[state=active]:bg-white">Mon Planning</TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-white">
              <Users className="w-4 h-4 mr-2" />Vue Équipe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : planning ? (
              <PlanningTable planning={planning} />
            ) : (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                Aucun planning pour cette semaine
              </div>
            )}
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : teamPlanning.length > 0 ? (
              <div className="space-y-4">
                {teamPlanning.map((p) => (
                  <Card key={p.id}>
                    <CardHeader>
                      <CardTitle className="text-sm">{p.user?.name || 'Membre'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PlanningTable planning={p} compact />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                Aucun planning d'équipe pour cette semaine
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showSwap} onOpenChange={setShowSwap}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demander un échange de planning</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Membre avec qui échanger</Label>
                <Select value={swapTarget} onValueChange={setSwapTarget}>
                  <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
                  <SelectContent>
                    {teamMembers.length > 0 ? (
                      teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">Aucun membre disponible</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-700">
                📅 Semaine du {formatWeekRange(weekStart, weekEnd)}
              </div>
              {swapTarget && (
                <div className="text-xs text-muted-foreground">
                  Une fois envoyé, le membre devra accepter votre demande avant validation par l'admin.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSwap(false)}>Annuler</Button>
              <Button onClick={handleSwapRequest} disabled={!swapTarget}>Envoyer la demande</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLeave} onOpenChange={setShowLeave}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demander un congé</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {leaveBalance && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-emerald-700">Solde congés annuels</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {leaveBalance.annualdays || 0} jours
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type de congé</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANNUEL">Congés Annuels</SelectItem>
                    <SelectItem value="EXCEPTIONNEL">Congés Exceptionnels</SelectItem>
                    <SelectItem value="MALADIE">Maladie</SelectItem>
                    <SelectItem value="AUTRE">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Raison (optionnel)</Label>
                <Textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Ex: Rendez-vous médical..." />
              </div>
              {leaveType !== 'ANNUEL' && (
                <div className="text-xs text-muted-foreground bg-slate-50 rounded px-3 py-2">
                  ℹ️ Les congés {leaveType === 'EXCEPTIONNEL' ? 'exceptionnels' : leaveType === 'MALADIE' ? 'maladie' : 'autres'} ne déduisent pas de ton solde annuel.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLeave(false)}>Annuler</Button>
              <Button onClick={handleLeaveRequest} disabled={!leaveStart || !leaveEnd}>Envoyer la demande</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}