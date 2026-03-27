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
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Calendar, Users, Repeat, Palmtree, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface PlanningDay {
  shift: string
  pause: string
  lunch: string
  isOff?: boolean
}

interface WeeklyPlanning {
  id: string
  userId: string
  weekStart: string
  weekEnd: string
  monday: PlanningDay | null
  tuesday: PlanningDay | null
  wednesday: PlanningDay | null
  thursday: PlanningDay | null
  friday: PlanningDay | null
  saturday: PlanningDay | null
  sunday: PlanningDay | null
  user?: { name: string; email: string }
}

interface LeaveBalance {
  annualDays: number
  exceptionalDays: number
  sickDays: number
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  sunday: 'Dimanche',
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi'
}

function getWeekRange(date: Date) {
  const day = date.getDay() // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - day) // Dimanche de la semaine courante
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6) // Samedi (6 jours après)
  
  return {
    start: sunday.toISOString().split('T')[0],
    end: saturday.toISOString().split('T')[0],
    sunday,
    saturday
  }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekEnd + 'T00:00:00')
  const startDay = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const endDay = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startDay} - ${endDay}`
}

export default function PlanningPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [currentWeek, setCurrentWeek] = useState(() => getWeekRange(new Date()))
  const [planning, setPlanning] = useState<WeeklyPlanning | null>(null)
  const [teamPlanning, setTeamPlanning] = useState<WeeklyPlanning[]>([])
  const [showTeam, setShowTeam] = useState(false)
  const [loading, setLoading] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  
  // Dialogs
  const [showSwap, setShowSwap] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [swapTarget, setSwapTarget] = useState('')
  const [leaveType, setLeaveType] = useState('ANNUEL')
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  const fetchPlanning = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    
    // Fetch user planning
    const res = await fetch(`/api/planning?userId=${user.id}&weekStart=${currentWeek.start}`)
    if (res.ok) {
      const data = await res.json()
      setPlanning(data)
    }
    
    // Fetch leave balance
    const balanceRes = await fetch(`/api/leave-balance?userId=${user.id}`)
    if (balanceRes.ok) {
      const balance = await balanceRes.json()
      setLeaveBalance(balance)
    }
    
    // Fetch team members for swap
    const membersRes = await fetch('/api/users')
    if (membersRes.ok) {
      const members = await membersRes.json()
      setTeamMembers(members.filter((m: any) => m.id !== user.id && m.role !== 'ADMIN'))
    }
    
    setLoading(false)
  }, [user?.id, currentWeek.start])

  const fetchTeamPlanning = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const res = await fetch(`/api/planning?weekStart=${currentWeek.start}&all=true`)
    if (res.ok) {
      const data = await res.json()
      setTeamPlanning(data)
    }
    setLoading(false)
  }, [user?.id, currentWeek.start])

  useEffect(() => {
    fetchPlanning()
  }, [fetchPlanning])

  const handlePrevWeek = () => {
  const newSunday = new Date(currentWeek.sunday)
  newSunday.setDate(newSunday.getDate() - 7)
  setCurrentWeek(getWeekRange(newSunday))
}

const handleNextWeek = () => {
  const newSunday = new Date(currentWeek.sunday)
  newSunday.setDate(newSunday.getDate() + 7)
  setCurrentWeek(getWeekRange(newSunday))
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
          weekStart: currentWeek.start,
          weekEnd: currentWeek.end,
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
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Mon Planning
            </h1>
            <p className="text-muted-foreground">Consultez et gérez votre emploi du temps</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowSwap(true)}>
              <Repeat className="w-4 h-4" />Demander Swap
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowLeave(true)}>
              <Palmtree className="w-4 h-4" />Demander Congé
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="font-semibold text-lg">{formatWeekRange(currentWeek.start, currentWeek.end)}</p>
                <p className="text-sm text-muted-foreground">Semaine du lundi au dimanche</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleNextWeek}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Mon Planning / Vue Équipe */}
        <Tabs value={showTeam ? 'team' : 'my'} onValueChange={(v) => setShowTeam(v === 'team')}>
          <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100">
            <TabsTrigger value="my" className="data-[state=active]:bg-white">Mon Planning</TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-white" onClick={fetchTeamPlanning}>
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

        {/* Leave Balance */}
       
      </div>

      {/* Swap Dialog */}
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
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-700">
              📅 Semaine du {formatWeekRange(currentWeek.start, currentWeek.end)}
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

      {/* Leave Dialog */}
      {/* Leave Dialog */}
<Dialog open={showLeave} onOpenChange={setShowLeave}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Demander un congé</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      
      {/* Solde annuel affiché en haut */}
      {leaveBalance && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-emerald-700">Solde congés annuels</span>
          <span className="text-lg font-bold text-emerald-700">
            {(leaveBalance as any).annualdays || (leaveBalance as any).annualDays || 0} jours
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

      {/* Info pour les types non-annuels */}
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
    </DashboardLayout>
  )
}

// ── Planning Table Component ─────────────────────────────────────────────────

function PlanningTable({ planning, compact = false }: { planning: WeeklyPlanning; compact?: boolean }) {
 const renderDay = (day: string) => {
  const dayData = planning[day as keyof WeeklyPlanning] as PlanningDay | null
  
  if (!dayData || !dayData.shift) {
    return (
      <div className="text-center py-2 bg-slate-50 rounded text-xs text-muted-foreground">
        OFF
      </div>
    )
  }
  
  return (
    <div className="text-center py-2">
      <div className="flex items-center justify-center gap-1 text-indigo-600">
        <Clock className="w-3 h-3" />
        <span className="font-medium text-sm">{dayData.shift}</span>
      </div>
    </div>
  )
}

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
  <tr>
    {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => (
      <th key={day} className="text-left px-4 py-3 font-medium text-muted-foreground">
        {DAY_LABELS[day]}
      </th>
    ))}
  </tr>
</thead>
        <tbody>
          <tr className="border-t">
            {DAYS.map(day => (
              <td key={day} className="px-4 py-3 border-r last:border-0">
                {renderDay(day)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}