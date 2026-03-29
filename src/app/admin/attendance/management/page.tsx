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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { 
  Clock, Calendar, Users, Plus, Edit2, Trash2, Save, X,
  CheckCircle, AlertTriangle, XCircle, Coffee, Utensils, Briefcase, GraduationCap
} from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface AttendanceRecord {
  id: string
  userId: string
  status: string
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  note: string | null
  user?: { name: string; email: string; jobRole: string }
  isAdjusted?: boolean
  adjustmentNote?: string
}

const STATUS_OPTIONS = [
  { value: 'EN_PRODUCTION', label: 'Production', icon: Clock, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'PAUSE', label: 'Pause', icon: Coffee, color: 'bg-amber-100 text-amber-700' },
  { value: 'LUNCH', label: 'Déjeuner', icon: Utensils, color: 'bg-orange-100 text-orange-700' },
  { value: 'REUNION', label: 'Réunion', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { value: 'FORMATION', label: 'Formation', icon: GraduationCap, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'AUTRE', label: 'Autre', icon: Clock, color: 'bg-slate-100 text-slate-700' },
]

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(dateString: string): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function getStatusBadge(status: string) {
  const option = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0]
  const Icon = option.icon
  return (
    <Badge className={`${option.color} border-0 text-xs gap-1`}>
      <Icon className="w-3 h-3" />
      {option.label}
    </Badge>
  )
}

export default function AdminAttendanceManagementPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [members, setMembers] = useState<{ id: string; name: string; jobRole: string }[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d
  })
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    userId: '',
    date: formatDate(new Date()),
    startTime: '09:00',
    endTime: '18:00',
    status: 'EN_PRODUCTION',
    note: '',
    adjustmentNote: '',
  })

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

  const fetchAttendanceRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      })
      if (selectedMember !== 'all') {
        params.set('userId', selectedMember)
      }

      const res = await fetch(`/api/attendance?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRecords(data)
      }
    } catch {
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedMember])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchAttendanceRecords()
  }, [fetchAttendanceRecords])

  const handleAddRecord = async () => {
    try {
      const startedAt = `${formData.date}T${formData.startTime}`
      const endedAt = formData.endTime ? `${formData.date}T${formData.endTime}` : null
      
      const durationMin = formData.endTime ? 
        Math.floor((new Date(endedAt!).getTime() - new Date(startedAt).getTime()) / 60000) : 
        null

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formData.userId,
          status: formData.status,
          startedAt,
          endedAt,
          durationMin,
          note: formData.note,
          isAdjustment: true,
          adjustmentNote: formData.adjustmentNote,
        }),
      })

      if (res.ok) {
        toast.success('Pointage ajouté avec succès')
        setIsAddDialogOpen(false)
        resetForm()
        fetchAttendanceRecords()
      } else {
        toast.error('Erreur lors de l\'ajout')
      }
    } catch {
      toast.error('Erreur lors de l\'ajout')
    }
  }

  const handleEditRecord = async () => {
    if (!editingRecord) return

    try {
      const startedAt = `${formData.date}T${formData.startTime}`
      const endedAt = formData.endTime ? `${formData.date}T${formData.endTime}` : null
      
      const durationMin = formData.endTime ? 
        Math.floor((new Date(endedAt!).getTime() - new Date(startedAt).getTime()) / 60000) : 
        null

      const res = await fetch(`/api/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          status: formData.status,
          startedAt,
          endedAt,
          durationMin,
          note: formData.note,
          isAdjustment: true,
          adjustmentNote: formData.adjustmentNote,
          overrideIsLate: formData.status !== 'ABSENT' ? false : undefined,
          overrideIsEarly: formData.status !== 'ABSENT' ? false : undefined,
        }),
      })

      if (res.ok) {
        toast.success('Pointage modifié avec succès')
        setIsEditDialogOpen(false)
        setEditingRecord(null)
        resetForm()
        fetchAttendanceRecords()
      } else {
        toast.error('Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDeleteRecord = async (id: string) => {
  if (!confirm('Supprimer ce pointage ?')) return

  try {
    const res = await fetch(`/api/attendance?id=${id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast.success('Pointage supprimé')
      fetchAttendanceRecords()
    } else {
      toast.error('Erreur lors de la suppression')
    }
  } catch {
    toast.error('Erreur lors de la suppression')
  }
}

  const openEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record)
    setFormData({
      userId: record.userId,
      date: record.startedAt.split('T')[0],
      startTime: formatTime(record.startedAt),
      endTime: record.endedAt ? formatTime(record.endedAt) : '',
      status: record.status,
      note: record.note || '',
      adjustmentNote: record.adjustmentNote || '',
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      userId: '',
      date: formatDate(new Date()),
      startTime: '09:00',
      endTime: '18:00',
      status: 'EN_PRODUCTION',
      note: '',
      adjustmentNote: '',
    })
  }

  const openAddDialog = () => {
    resetForm()
    setIsAddDialogOpen(true)
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

  if (!isAdmin && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <p className="text-muted-foreground">Accès réservé aux administrateurs</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>Retour</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Gestion des Présences
            </h1>
            <p className="text-muted-foreground">Ajustez et corrigez les pointages de l'équipe</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un pointage
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un pointage</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Membre</Label>
                  <Select value={formData.userId} onValueChange={(v) => setFormData({...formData, userId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un membre" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formData.date ? formatDisplayDate(new Date(formData.date)) : 'Sélectionner'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(formData.date)}
                        onSelect={(d) => d && setFormData({...formData, date: formatDate(d)})}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Heure début</Label>
                    <Input 
                      type="time" 
                      value={formData.startTime}
                      onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Heure fin</Label>
                    <Input 
                      type="time" 
                      value={formData.endTime}
                      onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="w-4 h-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea 
                    value={formData.note}
                    onChange={(e) => setFormData({...formData, note: e.target.value})}
                    placeholder="Note optionnelle..."
                    className="min-h-[60px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Justification de l'ajustement</Label>
                  <Textarea 
                    value={formData.adjustmentNote}
                    onChange={(e) => setFormData({...formData, adjustmentNote: e.target.value})}
                    placeholder="Pourquoi cet ajustement ?"
                    className="min-h-[60px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddRecord} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Membre</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">👥 Tous les membres</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Du</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDisplayDate(startDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Au</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDisplayDate(endDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card className="border-2 border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Pointages ({records.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Aucun pointage pour cette période</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Membre</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Statut</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Début</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Fin</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Durée</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground">Note</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => (
                      <tr key={record.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2">
                          {new Date(record.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-3 py-2 font-medium">{record.user?.name || 'N/A'}</td>
                        <td className="px-2 py-2 text-center">{getStatusBadge(record.status)}</td>
                        <td className="px-2 py-2 text-center font-mono">{formatTime(record.startedAt)}</td>
                        <td className="px-2 py-2 text-center font-mono">{formatTime(record.endedAt || '')}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {record.durationMin ? `${record.durationMin}min` : '—'}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground max-w-[150px] truncate">
                          {record.note || (record.isAdjusted ? `📝 ${record.adjustmentNote}` : '—')}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(record)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteRecord(record.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier le pointage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Membre</Label>
                <Select value={formData.userId} onValueChange={(v) => setFormData({...formData, userId: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heure début</Label>
                  <Input 
                    type="time" 
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure fin</Label>
                  <Input 
                    type="time" 
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="w-4 h-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea 
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Justification de la modification</Label>
                <Textarea 
                  value={formData.adjustmentNote}
                  onChange={(e) => setFormData({...formData, adjustmentNote: e.target.value})}
                  placeholder="Pourquoi cette modification ?"
                  className="min-h-[60px]"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleEditRecord} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}