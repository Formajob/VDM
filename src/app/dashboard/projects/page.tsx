'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Package, TrendingUp, Clock, ChevronLeft, ChevronRight, FileText, Edit3, X, Trash2, Calendar, User, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface Project {
  id: string
  name: string
  seriesName: string
  season: string | null
  episodeNumber: string | null
  broadcastChannel: string | null
  projectCode: string | null
  projectType: string | null
  deadline: string
  startDate: string | null
  durationMin: number | null
  pageCount: number | null
  status: string | null
  mixStatus: string | null
  workflowStep: string | null
  redacteurId: string | null
  techSonId: string | null
  createdAt: string
  comment: string | null
  writtenAt: string | null
  deliveredAt: string | null
  User: { id: string; name: string } | null
  User_1: { id: string; name: string } | null
}

interface WorkflowStats {
  reception: { projects: number; minutes: number }
  echeance: { projects: number; minutes: number }
  livraison: { projects: number; minutes: number }
}

interface MonthlyStats {
  totalProjects: number
  totalMinutes: number
  workflow: WorkflowStats
  chains: Record<string, { projects: number; minutes: number }>
}

interface MonthlyData {
  month: string
  monthNum: number
  reception: { projects: number; minutes: number }
  echeance: { projects: number; minutes: number }
  livraison: { projects: number; minutes: number }
}

type SortField = 'deadline' | 'createdAt' | 'name' | 'durationMin'
type SortOrder = 'asc' | 'desc'
type ReportType = 'monthly' | 'yearly'

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  FAIT: { label: 'Fait', color: 'bg-emerald-100 text-emerald-700' },
  EN_COURS: { label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  PAS_ENCORE: { label: 'Pas encore', color: 'bg-slate-100 text-slate-600' },
  SIGNALE: { label: 'Signalé', color: 'bg-amber-100 text-amber-700' },
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) status = 'PAS_ENCORE'
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!cfg) return <span>{status}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function displayDateLocal(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function getMonthFromDate(dateString: string): number {
  return new Date(dateString).getMonth()
}

function getYearFromDate(dateString: string): number {
  return new Date(dateString).getFullYear()
}

// ✅ COMPOSANT: Rapport Annuel Détaillé par Mois
function YearlyReport({ projects, year }: { projects: Project[], year: number }) {
  // Générer les données pour les 12 mois
  const monthlyData: MonthlyData[] = useMemo(() => {
    const data: MonthlyData[] = []
    
    for (let month = 0; month < 12; month++) {
      const monthProjects = projects.filter(p => {
        const projectYear = getYearFromDate(p.createdAt)
        return projectYear === year
      })
      
      data.push({
        month: MONTHS[month],
        monthNum: month + 1,
        reception: { projects: 0, minutes: 0 },
        echeance: { projects: 0, minutes: 0 },
        livraison: { projects: 0, minutes: 0 }
      })
    }
    
    // Calculer les statistiques pour chaque mois
    projects.forEach(project => {
      const projectYear = getYearFromDate(project.createdAt)
      if (projectYear !== year) return
      
      const duration = project.durationMin || 0
      
      // Réception (basé sur createdAt)
      const receptionMonth = getMonthFromDate(project.createdAt)
      data[receptionMonth].reception.projects += 1
      data[receptionMonth].reception.minutes += duration
      
      // Échéance (basé sur deadline)
      if (project.deadline) {
        const deadlineMonth = getMonthFromDate(project.deadline)
        data[deadlineMonth].echeance.projects += 1
        data[deadlineMonth].echeance.minutes += duration
      }
      
      // Livraison (basé sur deliveredAt)
      if (project.deliveredAt) {
        const deliveryMonth = getMonthFromDate(project.deliveredAt)
        data[deliveryMonth].livraison.projects += 1
        data[deliveryMonth].livraison.minutes += duration
      }
    })
    
    return data
  }, [projects, year])

  // Totaux généraux
  const totals = useMemo(() => {
    return monthlyData.reduce((acc, m) => ({
      reception: {
        projects: acc.reception.projects + m.reception.projects,
        minutes: acc.reception.minutes + m.reception.minutes
      },
      echeance: {
        projects: acc.echeance.projects + m.echeance.projects,
        minutes: acc.echeance.minutes + m.echeance.minutes
      },
      livraison: {
        projects: acc.livraison.projects + m.livraison.projects,
        minutes: acc.livraison.minutes + m.livraison.minutes
      }
    }), {
      reception: { projects: 0, minutes: 0 },
      echeance: { projects: 0, minutes: 0 },
      livraison: { projects: 0, minutes: 0 }
    })
  }, [monthlyData])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LIVRAISON */}
        <Card className="border-emerald-200">
          <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-t-lg">
            <CardTitle className="text-center text-lg flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              LIVRAISON
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-emerald-700">Mois</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-emerald-700">Projets</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-emerald-700">Minutes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {monthlyData.map((m, idx) => (
                    <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-700">{m.month}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">{m.livraison.projects}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{Math.round(m.livraison.minutes).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-100 font-bold">
                    <td className="py-2.5 px-3 text-emerald-900">Total général</td>
                    <td className="py-2.5 px-3 text-right text-emerald-900">{totals.livraison.projects}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-900">{Math.round(totals.livraison.minutes).toLocaleString('fr-FR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* RÉCEPTION */}
        <Card className="border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-lg">
            <CardTitle className="text-center text-lg flex items-center justify-center gap-2">
              <Calendar className="w-5 h-5" />
              RÉCEPTION
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700">Mois</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-blue-700">Projets</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-blue-700">Minutes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {monthlyData.map((m, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-700">{m.month}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">{m.reception.projects}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{Math.round(m.reception.minutes).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100 font-bold">
                    <td className="py-2.5 px-3 text-blue-900">Total général</td>
                    <td className="py-2.5 px-3 text-right text-blue-900">{totals.reception.projects}</td>
                    <td className="py-2.5 px-3 text-right text-blue-900">{Math.round(totals.reception.minutes).toLocaleString('fr-FR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ÉCHÉANCE */}
        <Card className="border-purple-200">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-t-lg">
            <CardTitle className="text-center text-lg flex items-center justify-center gap-2">
              <Clock className="w-5 h-5" />
              ÉCHÉANCE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-purple-700">Mois</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-purple-700">Projets</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-purple-700">Minutes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {monthlyData.map((m, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/50 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-700">{m.month}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">{m.echeance.projects}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{Math.round(m.echeance.minutes).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                  <tr className="bg-purple-100 font-bold">
                    <td className="py-2.5 px-3 text-purple-900">Total général</td>
                    <td className="py-2.5 px-3 text-right text-purple-900">{totals.echeance.projects}</td>
                    <td className="py-2.5 px-3 text-right text-purple-900">{Math.round(totals.echeance.minutes).toLocaleString('fr-FR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ✅ MODAL DE MODIFICATION COMPLÈTE
function EditProjectModal({ project, users, onClose, onSave, onDelete }: {
  project: Project | null
  users: { id: string; name: string; jobRole: string }[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [formData, setFormData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        seriesName: project.seriesName || '',
        season: project.season || '',
        episodeNumber: project.episodeNumber || '',
        broadcastChannel: project.broadcastChannel || '',
        projectCode: project.projectCode || '',
        projectType: project.projectType || '',
        deadline: project.deadline?.split('T')[0] || '',
        startDate: project.startDate?.split('T')[0] || '',
        durationMin: project.durationMin || 0,
        pageCount: project.pageCount || 0,
        status: project.status || 'PAS_ENCORE',
        mixStatus: project.mixStatus || '',
        workflowStep: project.workflowStep || 'DISPATCH',
        redacteurId: project.redacteurId || 'none',
        techSonId: project.techSonId || 'none',
        comment: project.comment || '',
        writtenAt: project.writtenAt?.split('T')[0] || '',
        deliveredAt: project.deliveredAt?.split('T')[0] || ''
      })
    }
  }, [project])

  const handleSave = async () => {
    const dataToSave = {
      ...formData,
      id: project?.id,
      redacteurId: formData.redacteurId === 'none' ? '' : formData.redacteurId,
      techSonId: formData.techSonId === 'none' ? '' : formData.techSonId
    }
    
    setSaving(true)
    await onSave(dataToSave)
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
    onClose()
  }

  if (!project) return null

  const redacteurs = users.filter(u => u.jobRole === 'REDACTEUR')
  const techSons = users.filter(u => u.jobRole === 'TECH_SON' || u.jobRole === 'NARRATEUR')

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Edit3 className="w-5 h-5 text-indigo-600" />
            Modifier le projet
          </DialogTitle>
          <DialogDescription>
            {project.name} - {project.projectCode}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          {/* Section 1: Informations générales */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Informations générales
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nom du projet *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nom de la série</Label>
                <Input
                  value={formData.seriesName}
                  onChange={e => setFormData({ ...formData, seriesName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Saison</Label>
                <Input
                  value={formData.season}
                  onChange={e => setFormData({ ...formData, season: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Épisode</Label>
                <Input
                  value={formData.episodeNumber}
                  onChange={e => setFormData({ ...formData, episodeNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Code projet</Label>
                <Input
                  value={formData.projectCode}
                  onChange={e => setFormData({ ...formData, projectCode: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Chaîne et Type */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Diffusion
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Chaîne</Label>
                <Select value={formData.broadcastChannel} onValueChange={v => setFormData({ ...formData, broadcastChannel: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADDIK">ADDIK</SelectItem>
                    <SelectItem value="casa">casa</SelectItem>
                    <SelectItem value="evasion">evasion</SelectItem>
                    <SelectItem value="tva">tva</SelectItem>
                    <SelectItem value="temoin">temoin</SelectItem>
                    <SelectItem value="zeste">zeste</SelectItem>
                    <SelectItem value="prise2">prise2</SelectItem>
                    <SelectItem value="LCN">LCN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type de projet</Label>
                <Select value={formData.projectType} onValueChange={v => setFormData({ ...formData, projectType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FILM">Film</SelectItem>
                    <SelectItem value="SERIE">Série</SelectItem>
                    <SelectItem value="EMISSION">Émission</SelectItem>
                    <SelectItem value="DOCUMENTAIRE">Documentaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Dates importantes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Dates importantes
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date de création</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date d'échéance *</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date de livraison</Label>
                <Input
                  type="date"
                  value={formData.deliveredAt}
                  onChange={e => setFormData({ ...formData, deliveredAt: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date de rédaction</Label>
                <Input
                  type="date"
                  value={formData.writtenAt}
                  onChange={e => setFormData({ ...formData, writtenAt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Durée (minutes)</Label>
                <Input
                  type="number"
                  value={formData.durationMin}
                  onChange={e => setFormData({ ...formData, durationMin: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Équipe */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4" />
              Équipe
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rédacteur</Label>
                <Select value={formData.redacteurId} onValueChange={v => setFormData({ ...formData, redacteurId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {redacteurs.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Technicien Son / Narrateur</Label>
                <Select value={formData.techSonId} onValueChange={v => setFormData({ ...formData, techSonId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {techSons.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 5: Statut et Workflow */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Statut et Workflow
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAS_ENCORE">Pas encore</SelectItem>
                    <SelectItem value="EN_COURS">En cours</SelectItem>
                    <SelectItem value="FAIT">Fait</SelectItem>
                    <SelectItem value="SIGNALE">Signalé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Workflow</Label>
                <Select value={formData.workflowStep} onValueChange={v => setFormData({ ...formData, workflowStep: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISPATCH">Dispatch</SelectItem>
                    <SelectItem value="REDACTION">Rédaction</SelectItem>
                    <SelectItem value="STUDIO">Studio</SelectItem>
                    <SelectItem value="LIVRAISON">Livraison</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Statut Mixage</Label>
              <Input
                value={formData.mixStatus}
                onChange={e => setFormData({ ...formData, mixStatus: e.target.value })}
                placeholder="Ex: En attente, Validé, etc."
              />
            </div>
          </div>

          {/* Section 6: Commentaire */}
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea
              value={formData.comment}
              onChange={e => setFormData({ ...formData, comment: e.target.value })}
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleDelete} 
            disabled={deleting}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProjectsDashboardPage() {
  const {  data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<{ id: string; name: string; jobRole: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  // Navigation mensuelle
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null)
  
  // ✅ NOUVEAU: Type de rapport (mensuel ou annuel)
  const [reportType, setReportType] = useState<ReportType>('monthly')
  
  // Modal de modification
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  // Charger les projets et utilisateurs
  useEffect(() => {
    if (status !== 'authenticated') return
    
    const fetchData = async () => {
      try {
        const [projectsRes, usersRes] = await Promise.all([
          fetch('/api/projects?includeAll=true'),
          fetch('/api/users?includeInactive=false')
        ])
        
        if (!projectsRes.ok || !usersRes.ok) throw new Error()
        
        const [projectsData, usersData] = await Promise.all([
          projectsRes.json(),
          usersRes.json()
        ])
        
        setProjects(projectsData.projects || [])
        setUsers(usersData || [])
      } catch (e) {
        console.error('Erreur chargement:', e)
        toast.error('Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [status])

  // Calculer les statistiques par WORKFLOW STEP
  const { monthProjects, stats } = useMemo(() => {
    const monthProjs = projects.filter(p => {
      const projectMonth = getMonthFromDate(p.createdAt)
      const projectYear = getYearFromDate(p.createdAt)
      return projectMonth === selectedMonth && projectYear === selectedYear
    })

    const workflow: WorkflowStats = {
      reception: { projects: 0, minutes: 0 },
      echeance: { projects: 0, minutes: 0 },
      livraison: { projects: 0, minutes: 0 }
    }

    const chains: Record<string, { projects: number; minutes: number }> = {}
    let totalMinutes = 0

    monthProjs.forEach(project => {
      const duration = project.durationMin || 0
      totalMinutes += duration
      
      const chain = project.broadcastChannel || 'Autre'
      if (!chains[chain]) {
        chains[chain] = { projects: 0, minutes: 0 }
      }
      chains[chain].projects += 1
      chains[chain].minutes += duration

      if (project.workflowStep === 'REDACTION' || project.createdAt) {
        workflow.reception.projects += 1
        workflow.reception.minutes += duration
      }
      if (project.deadline) {
        workflow.echeance.projects += 1
        workflow.echeance.minutes += duration
      }
      if (project.deliveredAt) {
        workflow.livraison.projects += 1
        workflow.livraison.minutes += duration
      }
    })

    const calculatedStats: MonthlyStats = {
      totalProjects: monthProjs.length,
      totalMinutes,
      workflow,
      chains
    }

    return { monthProjects: monthProjs, stats: calculatedStats }
  }, [projects, selectedMonth, selectedYear])

  // Filtrage et tri
  const displayedProjects = useMemo(() => {
    let result = [...monthProjects]
    
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.seriesName?.toLowerCase().includes(q) ||
        p.projectCode?.toLowerCase().includes(q)
      )
    }
    
    if (workflowFilter !== 'all') {
      result = result.filter(p => p.workflowStep === workflowFilter)
    }
    
    result.sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'deadline': aVal = a.deadline; bVal = b.deadline; break
        case 'createdAt': aVal = a.createdAt; bVal = b.createdAt; break
        case 'name': aVal = a.name; bVal = b.name; break
        case 'durationMin': aVal = a.durationMin || 0; bVal = b.durationMin || 0; break
        default: return 0
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    
    return result
  }, [monthProjects, search, workflowFilter, sortField, sortOrder])

  // Sauvegarder les modifications
  const handleSaveProject = async (data: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur')
      }
      toast.success('Projet modifié avec succès')
      const res2 = await fetch('/api/projects?includeAll=true')
      const data2 = await res2.json()
      setProjects(data2.projects || [])
      setEditingProject(null)
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`)
    }
  }

  // Supprimer un projet
  const handleDeleteProject = async () => {
    if (!editingProject) return
    try {
      const res = await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingProject.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur')
      }
      toast.success('Projet supprimé avec succès')
      const res2 = await fetch('/api/projects?includeAll=true')
      const data2 = await res2.json()
      setProjects(data2.projects || [])
      setEditingProject(null)
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`)
    }
  }

  // Export PDF
  const exportMonthlyInvoice = async () => {
    if (!stats || stats.totalProjects === 0) {
      toast.error('Aucun projet à exporter pour ce mois')
      return
    }

    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      
      const doc = new jsPDF()
      const monthName = MONTHS[selectedMonth]
      
      doc.setFillColor(79, 70, 229)
      doc.rect(0, 0, 210, 50, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(26)
      doc.setFont('helvetica', 'bold')
      doc.text('VDM - PRODUCTIONS', 105, 18, { align: 'center' })
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'normal')
      doc.text('RAPPORT MENSUEL D\'ACTIVITÉ', 105, 28, { align: 'center' })
      
      doc.setFontSize(11)
      doc.text(`Période: ${monthName} ${selectedYear}`, 105, 38, { align: 'center' })
      doc.text(`Date d'émission: ${new Date().toLocaleDateString('fr-FR')}`, 105, 44, { align: 'center' })
      
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('RÉCAPITULATIF PAR CHAÎNE', 14, 65)
      
      const chainData = Object.entries(stats.chains).map(([chain, data]) => [
        chain,
        data.projects.toString(),
        Math.round(data.minutes).toLocaleString('fr-FR')
      ])
      
      autoTable(doc, {
        startY: 70,
        head: [['Chaîne', 'Nombre de Projets', 'Durée (minutes)']],
        body: chainData,
        foot: [[
          { content: 'Total général', colSpan: 1, styles: { fontStyle: 'bold' } },
          { content: stats.totalProjects.toString(), styles: { fontStyle: 'bold' } },
          { content: Math.round(stats.totalMinutes).toLocaleString('fr-FR'), styles: { fontStyle: 'bold' } }
        ]],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        footStyles: { fillColor: [79, 70, 229], textColor: 255 },
        styles: { fontSize: 10 }
      })
      
      doc.addPage()
      
      doc.setFillColor(79, 70, 229)
      doc.rect(0, 0, 210, 20, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('DÉTAILS DES PROJETS', 105, 13, { align: 'center' })
      
      const projectData = displayedProjects.map(p => [
        p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
        p.broadcastChannel || '-',
        p.status || 'PAS_ENCORE',
        p.workflowStep || 'DISPATCH',
        displayDateLocal(p.createdAt),
        displayDateLocal(p.deadline),
        displayDateLocal(p.deliveredAt),
        Math.round(p.durationMin || 0).toString(),
        p.User?.name || '-',
        p.User_1?.name || '-'
      ])
      
      autoTable(doc, {
        startY: 25,
        head: [['Projet', 'Chaîne', 'Statut', 'Workflow', 'Création', 'Échéance', 'Livraison', 'Durée', 'Rédacteur', 'Tech Son']],
        body: projectData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 15 },
          2: { cellWidth: 15 },
          3: { cellWidth: 15 },
          4: { cellWidth: 15 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 12 },
          8: { cellWidth: 20 },
          9: { cellWidth: 20 }
        },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'body' && cellData.column.index === 2) {
            const status = cellData.cell.raw
            if (status === 'FAIT') {
              cellData.cell.styles.textColor = [16, 185, 129]
              cellData.cell.styles.fontStyle = 'bold'
            } else if (status === 'EN_COURS') {
              cellData.cell.styles.textColor = [59, 130, 246]
            }
          }
        }
      })
      
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${i} sur ${pageCount} - VDM Productions`, 105, 290, { align: 'center' })
      }
      
      const fileName = `Rapport_${monthName.toLowerCase()}_${selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
      
      toast.success(`Rapport ${monthName} ${selectedYear} exporté avec succès!`)
      
    } catch (e: any) {
      console.error('Erreur export PDF:', e)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  const handleSort = (field: SortField) => {
    setSortField(field)
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(prev => prev - 1)
    } else {
      setSelectedMonth(prev => prev - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(prev => prev + 1)
    } else {
      setSelectedMonth(prev => prev + 1)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Navigation mensuelle avec statistiques WORKFLOW */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="text-white hover:bg-white/20">
                <ChevronLeft className="w-6 h-6" />
              </Button>
              
              <div className="text-center">
                <h2 className="text-2xl font-bold capitalize">{MONTHS[selectedMonth]} {selectedYear}</h2>
                <p className="text-indigo-200 text-sm">Statistiques de production</p>
              </div>
              
              <Button variant="ghost" size="icon" onClick={goToNextMonth} className="text-white hover:bg-white/20">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              {/* ✅ BOUTONS: Basculer entre rapports */}
              <Button
                variant={reportType === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReportType('monthly')}
                className={reportType === 'monthly' ? 'bg-white text-indigo-600' : 'text-white border-white hover:bg-white/20'}
              >
                Rapport Mensuel
              </Button>
              <Button
                variant={reportType === 'yearly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReportType('yearly')}
                className={reportType === 'yearly' ? 'bg-white text-indigo-600' : 'text-white border-white hover:bg-white/20'}
              >
                Rapport Annuel
              </Button>
              
              <Button 
                onClick={exportMonthlyInvoice}
                disabled={!stats || stats.totalProjects === 0}
                className="bg-white text-indigo-600 hover:bg-indigo-50 gap-2 shadow-md"
              >
                <FileText className="w-5 h-5" />
                Exporter
              </Button>
            </div>
          </div>
          
          {/* Contenu conditionnel selon le type de rapport */}
          {reportType === 'monthly' ? (
            /* Stats par ÉTAPE (rapport mensuel actuel) */
            stats && (
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
                  <div className="flex items-center gap-2 text-indigo-200 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Réception</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.workflow.reception.projects}</p>
                  <p className="text-xs text-indigo-200">{Math.round(stats.workflow.reception.minutes)} min</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
                  <div className="flex items-center gap-2 text-indigo-200 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Échéance</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.workflow.echeance.projects}</p>
                  <p className="text-xs text-indigo-200">{Math.round(stats.workflow.echeance.minutes)} min</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
                  <div className="flex items-center gap-2 text-indigo-200 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Livraison</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.workflow.livraison.projects}</p>
                  <p className="text-xs text-indigo-200">{Math.round(stats.workflow.livraison.minutes)} min</p>
                </div>
              </div>
            )
          ) : (
            /* ✅ RAPPORT ANNUEL DÉTAILLÉ */
            <YearlyReport projects={projects} year={selectedYear} />
          )}
        </div>

        {/* Filtres (seulement pour le rapport mensuel) */}
        {reportType === 'monthly' && (
          <div className="flex flex-wrap gap-3">
            <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="DISPATCH">Dispatch</SelectItem>
                <SelectItem value="REDACTION">Rédaction</SelectItem>
                <SelectItem value="STUDIO">Studio</SelectItem>
                <SelectItem value="LIVRAISON">Livraison</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline">Échéance</SelectItem>
                <SelectItem value="createdAt">Création</SelectItem>
                <SelectItem value="name">Nom</SelectItem>
                <SelectItem value="durationMin">Durée</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-10 w-10 p-0"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
            
            <div className="relative flex-1 min-w-[250px]">
              <Input 
                placeholder="Rechercher (nom, série, code...)" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="pl-9" 
              />
            </div>
          </div>
        )}

        {/* Table (seulement pour le rapport mensuel) */}
        {reportType === 'monthly' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {displayedProjects.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">Aucun projet</h3>
                <p className="text-slate-500">Aucun projet trouvé pour {MONTHS[selectedMonth]} {selectedYear}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Projet</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Chaîne</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Statut</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Workflow</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Création</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Échéance</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Livraison</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Durée</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Rédacteur</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Tech Son</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedProjects.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{p.name}</div>
                          {p.seriesName && (
                            <div className="text-xs text-slate-500">{p.seriesName}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {p.broadcastChannel || '-'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`text-xs ${
                            p.workflowStep === 'REDACTION' ? 'bg-indigo-100 text-indigo-700' :
                            p.workflowStep === 'STUDIO' ? 'bg-purple-100 text-purple-700' :
                            p.workflowStep === 'LIVRAISON' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {p.workflowStep || 'DISPATCH'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {displayDateLocal(p.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {displayDateLocal(p.deadline)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {displayDateLocal(p.deliveredAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-slate-700">
                            <Clock className="w-3 h-3" />
                            {p.durationMin ? `${Math.round(p.durationMin)} min` : '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.User?.name || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.User_1?.name || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-amber-600 hover:text-amber-700"
                              onClick={() => setEditingProject(p)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {/* Footer info */}
        <div className="text-center text-sm text-slate-500">
          {reportType === 'monthly' ? (
            `${displayedProjects.length} projet${displayedProjects.length > 1 ? 's' : ''} trouvé${displayedProjects.length > 1 ? 's' : ''} pour ${MONTHS[selectedMonth]} ${selectedYear}`
          ) : (
            `Rapport annuel ${selectedYear} - ${projects.filter(p => getYearFromDate(p.createdAt) === selectedYear).length} projets au total`
          )}
        </div>
      </div>

      {/* MODAL DE MODIFICATION COMPLÈTE */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          users={users}
          onClose={() => setEditingProject(null)}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
        />
      )}
    </DashboardLayout>
  )
}