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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Calendar, ChevronLeft, ChevronRight, Edit, Users, Filter, Clock, Copy } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

// ✅ INTERFACE CORRIGÉE pour correspondre au format BDD
interface PlanningDayRaw {
  startTime?: string
  endTime?: string
  shiftType?: 'NORMAL' | 'NIGHT' | 'OFF' | 'VAC' | 'MALADIE' | 'AUTRE'
}

interface WeeklyPlanning {
  id: string
  userid: string
  weekstart: string
  weekend: string
  sunday: PlanningDayRaw | null
  monday: PlanningDayRaw | null
  tuesday: PlanningDayRaw | null
  wednesday: PlanningDayRaw | null
  thursday: PlanningDayRaw | null
  friday: PlanningDayRaw | null
  saturday: PlanningDayRaw | null
  user?: { name: string; email: string; jobRole: string }
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS: Record<string, string> = {
  sunday: 'Dim', monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
  thursday: 'Jeu', friday: 'Ven', saturday: 'Sam'
}
const FULL_DAY_LABELS: Record<string, string> = {
  sunday: 'Dimanche', monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi'
}

// ✅ OPTIONS CORRIGÉES pour correspondre aux shiftType de la BDD
const STATUS_OPTIONS = [
  { value: 'NORMAL', label: 'Shift normal', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'NIGHT', label: 'Shift de nuit', color: 'bg-purple-100 text-purple-700' },
  { value: 'VAC', label: 'Congé', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'OFF', label: 'OFF', color: 'bg-slate-100 text-slate-700' },
  { value: 'MALADIE', label: 'Maladie', color: 'bg-red-100 text-red-700' },
  { value: 'AUTRE', label: 'Autre', color: 'bg-amber-100 text-amber-700' },
]

function getWeekRange(date: Date) {
  const day = date.getDay()
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - day)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
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
  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// ✅ FONCTION POUR FORMATER L'AFFICHAGE DU SHIFT
function formatShiftDisplay(dayData: PlanningDayRaw | null): string {
  if (!dayData?.startTime || !dayData?.endTime) return '—'
  return `${dayData.startTime}-${dayData.endTime}`
}

export default function AdminPlanningManagementPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [currentWeek, setCurrentWeek] = useState(() => getWeekRange(new Date()))
  const [teamPlanning, setTeamPlanning] = useState<WeeklyPlanning[]>([])
  const [members, setMembers] = useState<{ id: string; name: string; jobRole: string }[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  
  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<{ userId: string; day: string } | null>(null)
  const [editStartTime, setEditStartTime] = useState('08:00')
  const [editEndTime, setEditEndTime] = useState('17:00')
  const [editShiftType, setEditShiftType] = useState<PlanningDayRaw['shiftType']>('NORMAL')
  const [saving, setSaving] = useState(false)

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

  const fetchTeamPlanning = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/planning?weekStart=${currentWeek.start}&all=true`)
    if (res.ok) {
      const data = await res.json()
      console.log('📊 Planning data received:', data)
      setTeamPlanning(data)
    }
    setLoading(false)
  }, [currentWeek.start])

  useEffect(() => {
    fetchMembers()
    fetchTeamPlanning()
  }, [fetchMembers, fetchTeamPlanning])

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

  // ✅ NOUVELLE FONCTION : Dupliquer le planning d'équipe vers la semaine suivante
  const handleDuplicateTeamToNextWeek = async () => {
    if (teamPlanning.length === 0) {
      toast.error('Aucun planning à dupliquer pour cette semaine')
      return
    }

    // Calculer la semaine suivante
    const nextSunday = new Date(currentWeek.sunday)
    nextSunday.setDate(nextSunday.getDate() + 7)
    const nextWeek = getWeekRange(nextSunday)

    try {
      setLoading(true)
      
      const res = await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'duplicateTeam',
          sourceWeekStart: currentWeek.start,
          targetWeekStart: nextWeek.start,
          targetWeekEnd: nextWeek.end,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erreur lors de la duplication')
      }

      const result = await res.json()
      
      toast.success(`Planning de l'équipe dupliqué ! ${result.duplicated} membre(s) 🎉`)
      
      if (result.errors > 0) {
        toast.warning(`${result.errors} erreur(s) lors de la duplication`)
      }
      
      // Passer automatiquement à la semaine suivante
      setCurrentWeek(nextWeek)
    } catch (error: any) {
      console.error('Error duplicating team planning:', error)
      toast.error(error.message || 'Impossible de dupliquer le planning')
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (userId: string, day: string, currentData: PlanningDayRaw | null) => {
    setEditingCell({ userId, day })
    setEditStartTime(currentData?.startTime || '08:00')
    setEditEndTime(currentData?.endTime || '17:00')
    setEditShiftType(currentData?.shiftType || 'NORMAL')
    setEditOpen(true)
  }

  // ✅ HANDLER CORRIGÉ avec méthode PUT et meilleure gestion des erreurs
  const handleSaveEdit = async () => {
    if (!editingCell) return
    
    setSaving(true)
    
    try {
      // ✅ Construire l'objet au format BDD
      const dayData: PlanningDayRaw = editShiftType === 'NORMAL' || editShiftType === 'NIGHT'
        ? { startTime: editStartTime, endTime: editEndTime, shiftType: editShiftType }
        : { shiftType: editShiftType }

      // ✅ Payload minimal - seulement le jour modifié
      const payload = {
        userid: editingCell.userId,
        weekstart: currentWeek.start,
        weekend: currentWeek.end,
        [editingCell.day]: dayData,
      }

      console.log('💾 Saving planning update:', payload)

      // ✅ Utiliser PUT au lieu de POST
      const res = await fetch('/api/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error('❌ Server error:', errorData)
        throw new Error(errorData.error || 'Erreur serveur')
      }

      const updatedPlanning = await res.json()
      console.log('✅ Planning updated:', updatedPlanning)

      // Rafraîchir les données
      await fetchTeamPlanning()
      
      toast.success('Planning mis à jour avec succès ! 🎉')
      setEditOpen(false)
    } catch (error: any) {
      console.error('❌ Error saving planning:', error)
      toast.error(error.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (dayData: PlanningDayRaw | null) => {
    if (!dayData || !dayData.shiftType) {
      return <span className="text-xs text-slate-400">—</span>
    }

    const option = STATUS_OPTIONS.find(o => o.value === dayData.shiftType)
    
    if (dayData.shiftType === 'NORMAL' || dayData.shiftType === 'NIGHT') {
      return (
        <div className="flex flex-col items-center gap-1">
          <Badge className={option?.color + ' text-xs border-0'}>
            {option?.label}
          </Badge>
          <span className="text-xs font-mono font-medium">
            {formatShiftDisplay(dayData)}
          </span>
        </div>
      )
    }

    return (
      <Badge className={option?.color + ' text-xs border-0'}>
        {option?.label}
      </Badge>
    )
  }

  const getFilteredPlanning = () => {
    if (selectedMember === 'all') return teamPlanning
    return teamPlanning.filter(p => p.userid === selectedMember)
  }

  if (!isDemo && status === 'loading') {
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
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Gestion Planning
          </h1>
          <p className="text-muted-foreground">Gérez le planning de toute l'équipe</p>
        </div>

        {/* Week Navigation & Duplicate Button */}
        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Navigation de semaine */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center flex-1">
                  <p className="font-semibold text-lg">{formatWeekRange(currentWeek.start, currentWeek.end)}</p>
                  <p className="text-sm text-muted-foreground">Semaine du dimanche au samedi</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleNextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* ✅ NOUVEAU : Bouton de duplication d'équipe */}
              {teamPlanning.length > 0 && (
                <div className="pt-4 border-t flex justify-center">
                  <Button 
                    variant="default" 
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    onClick={handleDuplicateTeamToNextWeek}
                    disabled={loading}
                  >
                    <Copy className="w-4 h-4" />
                    Dupliquer le planning d'équipe vers la semaine suivante
                  </Button>
                </div>
              )}

              {/* Member Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tous les membres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">👥 Tous les membres</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} • {m.jobRole}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info */}
              <div className="text-sm text-muted-foreground">
                <Users className="w-4 h-4 inline mr-1" />
                {getFilteredPlanning().length} membre{getFilteredPlanning().length > 1 ? 's' : ''} affiché{getFilteredPlanning().length > 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Planning Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : (
          <div className="space-y-6">
            {getFilteredPlanning().map((planning) => (
              <Card key={planning.id} className="border-2 border-indigo-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{planning.user?.name || 'Membre'} • {planning.user?.jobRole}</span>
                    <Badge variant="outline" className="text-xs">
                      {planning.user?.email}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          {DAYS.map(day => (
                            <th key={day} className="text-center px-2 py-3 font-medium text-muted-foreground text-xs border-r last:border-0">
                              {DAY_LABELS[day]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {DAYS.map(day => {
                            const dayData = planning[day as keyof WeeklyPlanning] as PlanningDayRaw | null
                            
                            return (
                              <td key={day} className="px-2 py-3 border-r last:border-0 align-top">
                                <div className="relative group">
                                  <div className={`p-2 rounded-lg border text-center min-h-[60px] flex flex-col items-center justify-center gap-1 ${
                                    dayData?.shiftType === 'NORMAL' ? 'border-indigo-200 bg-indigo-50/50' :
                                    dayData?.shiftType === 'NIGHT' ? 'border-purple-200 bg-purple-50/50' :
                                    dayData?.shiftType === 'VAC' ? 'border-emerald-200 bg-emerald-50/50' :
                                    dayData?.shiftType === 'MALADIE' ? 'border-red-200 bg-red-50/50' :
                                    dayData?.shiftType === 'AUTRE' ? 'border-amber-200 bg-amber-50/50' :
                                    'border-slate-200 bg-slate-50'
                                  }`}>
                                    {getStatusBadge(dayData)}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md border"
                                    onClick={() => handleEditClick(planning.userid, day, dayData)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {getFilteredPlanning().length === 0 && (
              <Card className="border-2 border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun planning pour cette semaine
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le planning - {editingCell ? FULL_DAY_LABELS[editingCell.day] : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              
              {/* Status selection */}
              <div className="space-y-2">
                <Label>Statut du jour</Label>
                <Select value={editShiftType} onValueChange={(v) => setEditShiftType(v as PlanningDayRaw['shiftType'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={opt.color + ' px-2 py-0.5 rounded text-xs'}>{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shift time - only show if NORMAL or NIGHT */}
              {(editShiftType === 'NORMAL' || editShiftType === 'NIGHT') && (
                <div className="space-y-2">
                  <Label>Horaires du shift</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="time" 
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">à</span>
                    <Input 
                      type="time" 
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Ces horaires seront utilisés pour calculer les retards et décharges
                  </p>
                </div>
              )}

              {/* Preview */}
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Aperçu</p>
                {(editShiftType === 'NORMAL' || editShiftType === 'NIGHT') ? (
                  <span className={`font-medium ${editShiftType === 'NIGHT' ? 'text-purple-700' : 'text-indigo-700'}`}>
                    {editStartTime}-{editEndTime}{editShiftType === 'NIGHT' && ' 🌙'}
                  </span>
                ) : (
                  <Badge className={STATUS_OPTIONS.find(o => o.value === editShiftType)?.color + ' border-0'}>
                    {STATUS_OPTIONS.find(o => o.value === editShiftType)?.label}
                  </Badge>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Enregistrement...
                  </>
                ) : (
                  'Enregistrer'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}