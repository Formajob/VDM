'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, TrendingUp, Clock, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
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

interface ChainStats {
  projects: number
  minutes: number
}

interface MonthlyStats {
  totalProjects: number
  totalMinutes: number
  chains: Record<string, ChainStats>
}

type SortField = 'deadline' | 'createdAt' | 'name' | 'durationMin'
type SortOrder = 'asc' | 'desc'

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

export default function ProjectsDashboardPage() {
  const { data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  // Navigation mensuelle
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null)

  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  // Charger les projets
  useEffect(() => {
    if (status !== 'authenticated') return
    
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects?includeAll=true')
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProjects(data.projects || [])
      } catch (e) {
        console.error('Erreur chargement:', e)
        toast.error('Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    
    fetchProjects()
  }, [status])

  // Calculer les statistiques mensuelles
  const { monthProjects, stats } = useMemo(() => {
    const monthProjs = projects.filter(p => {
      const projectMonth = getMonthFromDate(p.createdAt)
      const projectYear = getYearFromDate(p.createdAt)
      return projectMonth === selectedMonth && projectYear === selectedYear
    })

    const chains: Record<string, ChainStats> = {}
    let totalMinutes = 0

    monthProjs.forEach(project => {
      const chain = project.broadcastChannel || 'Autre'
      const duration = project.durationMin || 0
      
      if (!chains[chain]) {
        chains[chain] = { projects: 0, minutes: 0 }
      }
      
      chains[chain].projects += 1
      chains[chain].minutes += duration
      totalMinutes += duration
    })

    const calculatedStats: MonthlyStats = {
      totalProjects: monthProjs.length,
      totalMinutes,
      chains
    }

    return { monthProjects: monthProjs, stats: calculatedStats }
  }, [projects, selectedMonth, selectedYear])

  // Filtrage et tri (avec useMemo pour éviter la boucle infinie)
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

  // Export PDF de la facture mensuelle
  const exportMonthlyInvoice = async () => {
    if (!stats || stats.totalProjects === 0) {
      toast.error('Aucun projet à exporter pour ce mois')
      return
    }

    try {
      // Import dynamique de jsPDF
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      
      const doc = new jsPDF()
      const monthName = MONTHS[selectedMonth]
      
      // ✅ En-tête stylisé
      doc.setFillColor(79, 70, 229)
      doc.rect(0, 0, 210, 40, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('FACTURE MENSUELLE', 105, 15, { align: 'center' })
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text('PRODUCTIONS AUDIOVISUELLES', 105, 25, { align: 'center' })
      
      doc.setFontSize(11)
      doc.text(`Période: ${monthName} ${selectedYear}`, 105, 33, { align: 'center' })
      doc.text(`Date d'émission: ${new Date().toLocaleDateString('fr-FR')}`, 105, 38, { align: 'center' })
      
      // ✅ RÉCAPITULATIF PAR CHAÎNE
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('RÉCAPITULATIF PAR CHAÎNE', 14, 55)
      
      const chainData = Object.entries(stats.chains).map(([chain, data]) => [
        chain,
        data.projects.toString(),
        Math.round(data.minutes).toLocaleString('fr-FR'),
        (data.minutes / 60).toFixed(2)
      ])
      
      autoTable(doc, {
        startY: 60,
        head: [['Chaîne', 'Nombre de Projets', 'Durée (minutes)', 'Durée (heures)']],
        body: chainData,
        foot: [[
          { content: 'TOTAL GÉNÉRAL', colSpan: 1, styles: { fontStyle: 'bold' } },
          { content: stats.totalProjects.toString(), styles: { fontStyle: 'bold' } },
          { content: Math.round(stats.totalMinutes).toLocaleString('fr-FR'), styles: { fontStyle: 'bold' } },
          { content: (stats.totalMinutes / 60).toFixed(2), styles: { fontStyle: 'bold' } }
        ]],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        footStyles: { fillColor: [79, 70, 229], textColor: 255 },
        styles: { fontSize: 10 }
      })
      
      // ✅ STATISTIQUES AVANCÉES
      const finalY = (doc as any).lastAutoTable?.finalY + 10 || 120
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('STATISTIQUES AVANCÉES', 14, finalY)
      
      const avgPerProject = stats.totalProjects > 0 
        ? (stats.totalMinutes / stats.totalProjects).toFixed(2) 
        : '0'
      
      const statusCounts: Record<string, number> = {}
      monthProjects.forEach(p => {
        const status = p.status || 'PAS_ENCORE'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      
      const statsData = [
        ['Total Projets', stats.totalProjects.toString()],
        ['Total Minutes', Math.round(stats.totalMinutes).toLocaleString('fr-FR')],
        ['Total Heures', (stats.totalMinutes / 60).toFixed(2)],
        ['Moyenne par projet', `${avgPerProject} min`],
        ['Nombre de chaînes', Object.keys(stats.chains).length.toString()]
      ]
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        statsData.push([`Projets ${status}`, count.toString()])
      })
      
      autoTable(doc, {
        startY: finalY + 5,
        body: statsData,
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { cellWidth: 80 }
        },
        styles: { fontSize: 10 }
      })
      
      // ✅ NOUVELLE PAGE - DÉTAILS DES PROJETS
      doc.addPage()
      
      doc.setFillColor(79, 70, 229)
      doc.rect(0, 0, 210, 20, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('DÉTAILS DES PROJETS', 105, 13, { align: 'center' })
      
      // ✅ Tableau des projets
      const projectData = displayedProjects.map(p => [
        p.name.length > 45 ? p.name.substring(0, 45) + '...' : p.name,
        p.broadcastChannel || '-',
        p.status || 'PAS_ENCORE',
        Math.round(p.durationMin || 0).toString(),
        displayDateLocal(p.createdAt),
        p.User?.name || '-',
        p.User_1?.name || '-'
      ])
      
      autoTable(doc, {
        startY: 25,
        head: [['Nom du Projet', 'Chaîne', 'Statut', 'Durée (min)', 'Date création', 'Rédacteur', 'Tech Son']],
        body: projectData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 22 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 }
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            const status = data.cell.raw
            if (status === 'FAIT') {
              data.cell.styles.textColor = [16, 185, 129]
              data.cell.styles.fontStyle = 'bold'
            } else if (status === 'EN_COURS') {
              data.cell.styles.textColor = [59, 130, 246]
            }
          }
        }
      })
      
      // ✅ Pied de page avec numérotation
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${i} sur ${pageCount}`, 105, 290, { align: 'center' })
      }
      
      // ✅ Télécharger le PDF
      const fileName = `Facture_${monthName.toLowerCase()}_${selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
      
      toast.success(`Facture ${monthName} ${selectedYear} exportée avec succès!`)
      
    } catch (e: any) {
      console.error('Erreur export PDF:', e)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  const handleSort = (field: SortField) => {
    setSortField(field)
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Navigation mois précédent/suivant
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
        
        {/* Navigation mensuelle avec statistiques */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
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
            
            {/* Bouton export facture */}
            <Button 
              onClick={exportMonthlyInvoice}
              disabled={!stats || stats.totalProjects === 0}
              className="bg-white text-indigo-600 hover:bg-indigo-50 gap-2"
            >
              <FileText className="w-5 h-5" />
              Exporter la facture
            </Button>
          </div>
          
          {/* Statistiques rapides */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-indigo-200 mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">Total Projets</span>
                </div>
                <p className="text-3xl font-bold">{stats.totalProjects}</p>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-indigo-200 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Total Minutes</span>
                </div>
                <p className="text-3xl font-bold">{Math.round(stats.totalMinutes)}</p>
                <p className="text-xs text-indigo-200">({(stats.totalMinutes / 60).toFixed(1)}h)</p>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-indigo-200 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Chaînes</span>
                </div>
                <p className="text-3xl font-bold">{Object.keys(stats.chains).length}</p>
              </div>
            </div>
          )}
        </div>

        {/* Répartition par chaîne */}
        {stats && Object.keys(stats.chains).length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.chains).map(([chain, data]) => (
              <Card key={chain}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-slate-500">{chain}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-slate-700">{data.projects}</p>
                      <p className="text-xs text-slate-500">projets</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-indigo-600">{Math.round(data.minutes)}</p>
                      <p className="text-xs text-slate-400">min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtres */}
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

        {/* Table */}
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
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Durée</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Échéance</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Rédacteur</th>
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
                        <Badge className="text-xs bg-purple-100 text-purple-700">
                          {p.workflowStep || 'DISPATCH'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Clock className="w-3 h-3" />
                          {p.durationMin ? `${Math.round(p.durationMin)} min` : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {displayDateLocal(p.deadline)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.User?.name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="text-center text-sm text-slate-500">
          {displayedProjects.length} projet{displayedProjects.length > 1 ? 's' : ''} trouvé{displayedProjects.length > 1 ? 's' : ''} pour {MONTHS[selectedMonth]} {selectedYear}
        </div>
      </div>
    </DashboardLayout>
  )
}