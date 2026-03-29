'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { 
  FileText, Download, Mail, Calendar, Users, 
  FileSpreadsheet, Send, Loader2, Repeat, AlertCircle
} from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface PlanningDay {
  shift: string
  status?: 'SHIFT' | 'CONGE' | 'OFF' | 'MALADIE' | 'AUTRE'
}

interface WeeklyPlanning {
  id: string
  userid: string
  weekstart: string
  weekend: string
  sunday: PlanningDay | null
  monday: PlanningDay | null
  tuesday: PlanningDay | null
  wednesday: PlanningDay | null
  thursday: PlanningDay | null
  friday: PlanningDay | null
  saturday: PlanningDay | null
  user?: { name: string; email: string; jobRole: string }
}

interface SwapRequest {
  id: string
  requesterid: string
  targetuserid: string
  weekstart: string
  weekend: string
  status: string
  createdat: string
  requester?: { name: string }
  target?: { name: string }
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS: Record<string, string> = {
  sunday: 'Dim', monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
  thursday: 'Jeu', friday: 'Ven', saturday: 'Sam'
}

const STATUS_COLORS: Record<string, string> = {
  SHIFT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CONGE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OFF: 'bg-slate-50 text-slate-700 border-slate-200',
  MALADIE: 'bg-red-50 text-red-700 border-red-200',
  AUTRE: 'bg-amber-50 text-amber-700 border-amber-200',
}

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
  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function AdminPlanningReportsPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [currentWeek, setCurrentWeek] = useState(() => getWeekRange(new Date()))
  const [planningData, setPlanningData] = useState<WeeklyPlanning[]>([])
  const [swapData, setSwapData] = useState<SwapRequest[]>([])
  const [members, setMembers] = useState<{ id: string; name: string; jobRole: string }[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[] | 'all'>('all')
  const [reportType, setReportType] = useState<'weekly' | 'modifications'>('weekly')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  
  const EMAIL_TRANSPORT = '####'
  const [includePDF, setIncludePDF] = useState(true)
  const [includeExcel, setIncludeExcel] = useState(true)
  const [emailNote, setEmailNote] = useState('')

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

  const fetchPlanningData = useCallback(async () => {
    const res = await fetch(`/api/planning?weekStart=${currentWeek.start}&all=true`)
    if (res.ok) {
      const data = await res.json()
      setPlanningData(data)
    }
  }, [currentWeek.start])

  const fetchSwapData = useCallback(async () => {
    const res = await fetch('/api/swap-request?type=admin')
    if (res.ok) {
      const data = await res.json()
      setSwapData(data)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
    fetchPlanningData()
    fetchSwapData()
  }, [fetchMembers, fetchPlanningData, fetchSwapData])

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

  const handleMemberToggle = (memberId: string) => {
    if (selectedMembers === 'all') {
      setSelectedMembers([memberId])
    } else if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId))
    } else {
      setSelectedMembers([...selectedMembers, memberId])
    }
  }

  const handleSelectAll = () => {
    if (selectedMembers === 'all' || (Array.isArray(selectedMembers) && selectedMembers.length === members.length)) {
      setSelectedMembers('all')
    } else {
      setSelectedMembers(members.map(m => m.id))
    }
  }

  const getFilteredPlanning = () => {
    if (selectedMembers === 'all') return planningData
    return planningData.filter(p => selectedMembers.includes(p.userid))
  }

  const getFilteredSwaps = () => {
    const weekSwaps = swapData.filter(s => 
      s.weekstart >= currentWeek.start && s.weekend <= currentWeek.end
    )
    if (selectedMembers === 'all') return weekSwaps
    return weekSwaps.filter(s => 
      selectedMembers.includes(s.requesterid) || selectedMembers.includes(s.targetuserid)
    )
  }

  const getDayDisplay = (dayData: PlanningDay | null) => {
    if (!dayData?.shift) return { text: 'OFF', class: STATUS_COLORS.OFF }
    if (dayData.status && dayData.status !== 'SHIFT') {
      return { text: dayData.status, class: STATUS_COLORS[dayData.status] || STATUS_COLORS.AUTRE }
    }
    return { text: dayData.shift, class: STATUS_COLORS.SHIFT }
  }

  const generateCSV = () => {
    const filtered = getFilteredPlanning()
    let csv = 'Membre,Rôle,Dimanche,Lundi,Mardi,Mercredi,Jeudi,Vendredi,Samedi\n'
    
    filtered.forEach(p => {
      const row = [
        `"${p.user?.name || 'N/A'}"`,
        `"${p.user?.jobRole || 'N/A'}"`,
        ...DAYS.map(day => {
          const dayData = p[day as keyof WeeklyPlanning] as PlanningDay | null
          const display = getDayDisplay(dayData)
          return `"${display.text}"`
        })
      ]
      csv += row.join(',') + '\n'
    })
    return csv
  }

  const generateModificationsText = () => {
    const swaps = getFilteredSwaps()
    let text = 'RAPPORT DES MODIFICATIONS SPÉCIALES\n'
    text += `Période : ${formatWeekRange(currentWeek.start, currentWeek.end)}\n`
    text += `Généré le : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`
    text += '='.repeat(60) + '\n\n'
    
    if (swaps.length === 0) {
      text += 'Aucune modification spéciale cette semaine.\n'
    } else {
      text += `Nombre de modifications : ${swaps.length}\n\n`
      swaps.forEach((swap, i) => {
        text += `${i + 1}. ÉCHANGE DE PLANNING\n`
        text += `   Demandeur : ${swap.requester?.name || 'N/A'}\n`
        text += `   Avec : ${swap.target?.name || 'N/A'}\n`
        text += `   Semaine : ${formatWeekRange(swap.weekstart, swap.weekend)}\n`
        text += `   Statut : ${swap.status}\n\n`
      })
    }
    return text
  }

  const handleGeneratePDF = async () => {
    setGenerating(true)
    try {
      const reportData = reportType === 'weekly' ? generateCSV() : generateModificationsText()
      const blob = new Blob([reportData], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_${reportType}_${currentWeek.start}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Rapport téléchargé')
    } catch {
      toast.error('Erreur lors du téléchargement')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateExcel = async () => {
    setGenerating(true)
    try {
      const csv = generateCSV()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `planning_${currentWeek.start}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel (CSV) téléchargé')
    } catch {
      toast.error('Erreur lors du téléchargement')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendEmail = async () => {
    setSending(true)
    try {
      const emailData = {
        to: EMAIL_TRANSPORT,
        subject: reportType === 'weekly' 
          ? `📅 Planning Hebdomadaire - ${formatWeekRange(currentWeek.start, currentWeek.end)}`
          : `⚠️ Rapport Modifications - ${formatWeekRange(currentWeek.start, currentWeek.end)}`,
        body: emailNote || (reportType === 'weekly'
          ? `Bonjour,\n\nVeuillez trouver ci-joint le planning hebdomadaire de l'équipe VDM pour la semaine du ${formatWeekRange(currentWeek.start, currentWeek.end)}.\n\nMembres inclus : ${getFilteredPlanning().length}\n\nCordialement,\nAdministration VDM`
          : `Bonjour,\n\nVeuillez trouver ci-joint le rapport des modifications spéciales pour la semaine du ${formatWeekRange(currentWeek.start, currentWeek.end)}.\n\nNombre de modifications : ${getFilteredSwaps().length}\n\nCordialement,\nAdministration VDM`),
        attachments: { pdf: includePDF, excel: includeExcel },
        weekStart: currentWeek.start,
        weekEnd: currentWeek.end,
        reportType,
      }

      const res = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      })

      if (!res.ok) throw new Error()
      
      toast.success('Email envoyé à ' + EMAIL_TRANSPORT)
      setEmailNote('')
    } catch {
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSending(false)
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
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Rapports Planning
          </h1>
          <p className="text-muted-foreground">Générez et envoyez les rapports au département Transport</p>
        </div>

        {/* Controls */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-6">
              <Label className="text-xs text-muted-foreground mb-2 block">Semaine</Label>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
                  <Calendar className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <p className="font-semibold text-sm">{formatWeekRange(currentWeek.start, currentWeek.end)}</p>
                  <p className="text-xs text-muted-foreground">Dim → Sam</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleNextWeek}>
                  <Calendar className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-6">
              <Label className="text-xs text-muted-foreground mb-2 block">Type de rapport</Label>
              <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Planning Hebdo
                    </div>
                  </SelectItem>
                  <SelectItem value="modifications">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Modifications
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Membres</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-6 text-xs">
                  {selectedMembers === 'all' ? 'Tous ✓' : 'Tout sélectionner'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
                {members.slice(0, 8).map(m => (
                  <div key={m.id} className="flex items-center gap-1">
                    <Checkbox
                      id={m.id}
                      className="w-3 h-3"
                      checked={selectedMembers === 'all' || (Array.isArray(selectedMembers) && selectedMembers.includes(m.id))}
                      onCheckedChange={() => handleMemberToggle(m.id)}
                    />
                    <Label htmlFor={m.id} className="text-xs cursor-pointer truncate">{m.name}</Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedMembers === 'all' ? members.length : Array.isArray(selectedMembers) ? selectedMembers.length : 0} membre(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Planning Preview Table */}
        <Card className="border-2 border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                Aperçu du Planning
              </span>
              <Badge variant="outline">{getFilteredPlanning().length} membres</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getFilteredPlanning().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Aucun planning pour cette semaine</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-slate-50">Membre</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Rôle</th>
                      {DAYS.map((day, index) => {
                        const dayDate = new Date(currentWeek.start)
                        dayDate.setDate(dayDate.getDate() + index)
                        const dateStr = dayDate.toLocaleDateString('fr-FR', { day: 'numeric' })
                        return (
                          <th key={day} className="text-center px-2 py-2 font-medium text-muted-foreground min-w-[80px]">
                            <div className="text-xs">{DAY_LABELS[day]}</div>
                            <div className="text-[10px] text-muted-foreground">{dateStr}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredPlanning().map(p => (
                      <tr key={p.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium sticky left-0 bg-white">{p.user?.name || 'N/A'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.user?.jobRole || 'N/A'}</td>
                        {DAYS.map(day => {
                          const dayData = p[day as keyof WeeklyPlanning] as PlanningDay | null
                          const display = getDayDisplay(dayData)
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <span className={`px-2 py-1 rounded border text-xs ${display.class}`}>
                                {display.text}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modifications Preview */}
        {reportType === 'modifications' && (
          <Card className="border-2 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Modifications Spéciales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getFilteredSwaps().length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune modification cette semaine</p>
              ) : (
                <div className="space-y-2">
                  {getFilteredSwaps().map(swap => (
                    <div key={swap.id} className="flex items-center gap-3 p-2 bg-amber-50 rounded border border-amber-200">
                      <Repeat className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium">{swap.requester?.name}</span>
                      <span className="text-muted-foreground">↔</span>
                      <span className="text-sm font-medium">{swap.target?.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs">{swap.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              Export et Envoi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleGeneratePDF} 
                disabled={generating || getFilteredPlanning().length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Exporter PDF
              </Button>
              <Button 
                onClick={handleGenerateExcel} 
                variant="outline"
                disabled={generating || getFilteredPlanning().length === 0}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                Exporter Excel
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-4 mb-3">
                <Label className="text-sm font-medium">Pièces jointes :</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="includePDF" 
                    checked={includePDF}
                    onCheckedChange={(v) => setIncludePDF(v as boolean)}
                  />
                  <Label htmlFor="includePDF" className="text-sm">PDF</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="includeExcel" 
                    checked={includeExcel}
                    onCheckedChange={(v) => setIncludeExcel(v as boolean)}
                  />
                  <Label htmlFor="includeExcel" className="text-sm">Excel</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note (optionnel)</Label>
                <Textarea 
                  value={emailNote} 
                  onChange={(e) => setEmailNote(e.target.value)}
                  placeholder="Message à ajouter à l'email..."
                  className="min-h-[60px]"
                />
              </div>

              <Button 
                onClick={handleSendEmail} 
                disabled={sending || getFilteredPlanning().length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Envoyer à {EMAIL_TRANSPORT}
              </Button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                <strong>📋 Workflow :</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>Vendredi</strong> : Rapport hebdomadaire → Transport</li>
                  <li><strong>Mi-semaine</strong> : Rapport modifications si besoin</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}