'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { 
  Download, Calendar, Users, TrendingUp, FileText, AlertCircle,
  ChevronLeft, ChevronRight, Filter, BarChart3
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
  user?: { name: string }
  isLate?: boolean
  lateMinutes?: number
}

interface EmployeeData {
  id: string
  name: string
  pr: string
  project: string
  dailyStatus: Map<string, string>
}

interface EmployeeSummary {
  id: string
  name: string
  totalPresent: number
  totalAbsent: number
  totalVac: number
  totalLate: number
  totalOff: number
  totalDays: number
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function getDayName(date: Date): string {
  const days = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
  return days[date.getDay()]
}

function getPayrollPeriod(selectedDate: Date) {
  const today = new Date()
  const currentDay = today.getDate()
  
  let startDate: Date
  let endDate: Date
  
  if (currentDay >= 20) {
    startDate = new Date(today.getFullYear(), today.getMonth(), 20)
    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 19)
  } else {
    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 20)
    endDate = new Date(today.getFullYear(), today.getMonth(), 19)
  }
  
  if (selectedDate) {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    startDate = new Date(year, month - 1, 20)
    endDate = new Date(year, month, 19)
  }
  
  const dates: Date[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  
  return { dates, startDate, endDate }
}

export default function AdminAttendanceReportsPage() {
  const { data: session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [members, setMembers] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [employeeData, setEmployeeData] = useState<EmployeeData[]>([])

  const { dates, startDate, endDate } = useMemo(() => 
    getPayrollPeriod(selectedMonth),
    [selectedMonth]
  )

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (!isAdmin && !isDemo) router.push('/dashboard')
  }, [status, router, isDemo, isAdmin])

  useEffect(() => {
    if (status !== 'authenticated' && !isDemo) return

    async function fetchData() {
      try {
        setLoading(true)
        
        const membersRes = await fetch('/api/users', { credentials: 'include' })
        if (!membersRes.ok) throw new Error('Failed to fetch users')
        const users = await membersRes.json()
        
        // ✅ DEBUG: Voir ce qu'on reçoit de l'API
        console.log('📊 All users from API:', users.map((u: any) => ({
          id: u.id,
          name: u.name,
          pr: u.pr,
          jobRole: u.jobRole,
          role: u.role
        })))
        
        const membersOnly = users.filter((u: any) => u.role === 'MEMBER')
        setMembers(membersOnly)
        
        setSelectedMemberIds(membersOnly.map((m: any) => m.id))
        
        const params = new URLSearchParams({
          startDate: formatDateKey(startDate),
          endDate: formatDateKey(endDate),
          all: 'true',
        })
        
        const attendanceRes = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
        if (!attendanceRes.ok) throw new Error('Failed to fetch attendance')
        const attendanceData: AttendanceRecord[] = await attendanceRes.json()
        
        const employeeMap = new Map<string, EmployeeData>()
        
        membersOnly.forEach((member: any) => {
          // ✅ DEBUG: Afficher le PR pour chaque membre
          console.log(`👤 Creating employee: ${member.name}, pr="${member.pr}", id="${member.id}"`)
          
          employeeMap.set(member.id, {
            id: member.id,
            name: member.name,
            pr: member.pr || 'N/A',  // ✅ Utiliser pr de la BDD
            project: member.jobRole || 'VD',
            dailyStatus: new Map(),
          })
        })
        
        attendanceData.forEach((record: AttendanceRecord) => {
          const date = record.startedAt.split('T')[0]
          const emp = employeeMap.get(record.userId)
          if (!emp) return
          
          let status = 'Présent'
          if (record.status === 'ABSENT') status = 'Absence'
          else if (record.status === 'CONGE') status = 'VAC'
          else if (record.status === 'PAUSE' || record.status === 'LUNCH') return
          else if (record.isLate && record.lateMinutes && record.lateMinutes < 999) {
            const hours = Math.floor(record.lateMinutes / 60)
            const mins = record.lateMinutes % 60
            status = `retard ${hours}h${mins.toString().padStart(2, '0')}`
          }
          
          const currentStatus = emp.dailyStatus.get(date)
          if (!currentStatus || currentStatus === 'Présent') {
            emp.dailyStatus.set(date, status)
          }
        })
        
        employeeMap.forEach(emp => {
          dates.forEach(date => {
            const dateKey = formatDateKey(date)
            if (!emp.dailyStatus.has(dateKey)) {
              // Laisser vide
            }
          })
        })
        
        setEmployeeData(Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        
      } catch (error: any) {
        console.error('Fetch error:', error)
        toast.error('Erreur: ' + error.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [startDate, endDate, status, isDemo])

  const handlePreviousMonth = () => {
    const newMonth = new Date(selectedMonth)
    newMonth.setMonth(newMonth.getMonth() - 1)
    setSelectedMonth(newMonth)
  }

  const handleNextMonth = () => {
    const newMonth = new Date(selectedMonth)
    newMonth.setMonth(newMonth.getMonth() + 1)
    setSelectedMonth(newMonth)
  }

  const handleToday = () => {
    setSelectedMonth(new Date())
  }

  const filteredEmployees = employeeData.filter(emp => 
    selectedMemberIds.includes(emp.id)
  )

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  const selectAllMembers = () => {
    setSelectedMemberIds(members.map(m => m.id))
  }

  const deselectAllMembers = () => {
    setSelectedMemberIds([])
  }

  const totalEmployees = filteredEmployees.length
  const presentDays = filteredEmployees.reduce((acc, emp) => 
    acc + Array.from(emp.dailyStatus.values()).filter(s => s === 'Présent').length, 0
  )
  const absentDays = filteredEmployees.reduce((acc, emp) => 
    acc + Array.from(emp.dailyStatus.values()).filter(s => s === 'Absence').length, 0
  )
  const vacDays = filteredEmployees.reduce((acc, emp) => 
    acc + Array.from(emp.dailyStatus.values()).filter(s => s === 'VAC').length, 0
  )
  const lateDays = filteredEmployees.reduce((acc, emp) => 
    acc + Array.from(emp.dailyStatus.values()).filter(s => s.includes('retard')).length, 0
  )
  const offDays = filteredEmployees.reduce((acc, emp) => 
    acc + Array.from(emp.dailyStatus.values()).filter(s => s === 'OFF').length, 0
  )

  const employeeSummary: EmployeeSummary[] = useMemo(() => {
    return filteredEmployees.map(emp => {
      const statuses = Array.from(emp.dailyStatus.values())
      return {
        id: emp.id,
        name: emp.name,
        totalPresent: statuses.filter(s => s === 'Présent').length,
        totalAbsent: statuses.filter(s => s === 'Absence').length,
        totalVac: statuses.filter(s => s === 'VAC').length,
        totalLate: statuses.filter(s => s.includes('retard')).length,
        totalOff: statuses.filter(s => s === 'OFF').length,
        totalDays: statuses.filter(s => s !== '').length,
      }
    })
  }, [filteredEmployees])

  const handleExportExcel = () => {
    let csv = 'Nom & Prénom;Projets;PR;'
    dates.forEach(date => {
      csv += `${getDayName(date)} ${formatDateKey(date)};`
    })
    csv += '\n'
    
    filteredEmployees.forEach(emp => {
      csv += `${emp.name};${emp.project};${emp.pr};`
      dates.forEach(date => {
        const dateKey = formatDateKey(date)
        const status = emp.dailyStatus.get(dateKey) || ''
        csv += `${status};`
      })
      csv += '\n'
    })
    
    csv += '\n\nRÉSUMÉ PAR MEMBRE\n'
    csv += 'Nom;Présents;Absences;Congés;Retards;OFF;Total jours\n'
    employeeSummary.forEach(summary => {
      csv += `${summary.name};${summary.totalPresent};${summary.totalAbsent};${summary.totalVac};${summary.totalLate};${summary.totalOff};${summary.totalDays}\n`
    })
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Attendance_Report_${formatDateKey(startDate).slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Rapport téléchargé avec résumé')
  }

  const getStatusColor = (status: string) => {
    if (!status) return ''
    if (status === 'Présent') return 'bg-emerald-50 text-emerald-700'
    if (status === 'OFF') return 'bg-orange-100 text-orange-700'
    if (status === 'VAC') return 'bg-yellow-100 text-yellow-700'
    if (status === 'Absence') return 'bg-red-100 text-red-700'
    if (status.includes('retard')) return 'bg-amber-100 text-amber-700'
    return 'bg-slate-50 text-slate-700'
  }

  if (!isAdmin && !isDemo) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Rapport de Présences - Paie
            </h1>
            <p className="text-muted-foreground">
              Période du {formatDisplayDate(startDate)} au {formatDisplayDate(endDate)}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Mois préc.
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Ce mois
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              Mois suiv.
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <div className="ml-4 px-4 py-2 bg-indigo-50 rounded-lg font-semibold text-indigo-700">
              {formatMonthYear(selectedMonth)}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Employés</p>
                  <p className="text-2xl font-bold text-indigo-600">{totalEmployees}</p>
                </div>
                <Users className="w-8 h-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Jours présents</p>
                  <p className="text-2xl font-bold text-emerald-600">{presentDays}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Absences</p>
                  <p className="text-2xl font-bold text-red-600">{absentDays}</p>
                </div>
                <FileText className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Congés</p>
                  <p className="text-2xl font-bold text-yellow-600">{vacDays}</p>
                </div>
                <Calendar className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Retards</p>
                  <p className="text-2xl font-bold text-amber-600">{lateDays}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Jours OFF</p>
                  <p className="text-2xl font-bold text-orange-600">{offDays}</p>
                </div>
                <Calendar className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-500" />
              Filtres par membres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Button variant="outline" size="sm" onClick={selectAllMembers}>
                Tout sélectionner
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllMembers}>
                Tout désélectionner
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedMemberIds.length} / {members.length} sélectionnés
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2 border rounded-lg">
              {members.map(member => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={member.id}
                    checked={selectedMemberIds.includes(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <label
                    htmlFor={member.id}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {member.name} (PR: {member.pr || 'N/A'})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Calendrier des présences
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-3"></div>
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                <p>Aucun membre sélectionné</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-indigo-50">
                      <th className="border border-indigo-200 px-2 py-2 font-bold text-left sticky left-0 bg-indigo-50">Nom</th>
                      <th className="border border-indigo-200 px-2 py-2 font-bold text-center">Projet</th>
                      <th className="border border-indigo-200 px-2 py-2 font-bold text-center">PR</th>
                      {dates.map(date => (
                        <th key={date.toISOString()} className="border border-indigo-200 px-1 py-2 font-semibold text-center min-w-[70px]">
                          <div className="flex flex-col">
                            <span className="text-[10px]">{getDayName(date)}</span>
                            <span>{date.toLocaleDateString('fr-FR').slice(0, 5)}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-2 py-2 font-medium sticky left-0 bg-white">{emp.name}</td>
                        <td className="border border-slate-200 px-2 py-2 text-center">{emp.project}</td>
                        <td className="border border-slate-200 px-2 py-2 text-center font-mono text-xs">{emp.pr}</td>
                        {dates.map(date => {
                          const dateKey = formatDateKey(date)
                          const status = emp.dailyStatus.get(dateKey) || ''
                          return (
                            <td 
                              key={dateKey} 
                              className={`border border-slate-200 px-1 py-2 text-center ${getStatusColor(status)}`}
                            >
                              {status}
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

        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Résumé par membre
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeeSummary.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Aucune donnée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-indigo-50 border-b">
                      <th className="px-3 py-2 text-left font-semibold">Membre</th>
                      <th className="px-3 py-2 text-center font-semibold text-emerald-700">Présents</th>
                      <th className="px-3 py-2 text-center font-semibold text-red-700">Absences</th>
                      <th className="px-3 py-2 text-center font-semibold text-yellow-700">Congés</th>
                      <th className="px-3 py-2 text-center font-semibold text-amber-700">Retards</th>
                      <th className="px-3 py-2 text-center font-semibold text-orange-700">OFF</th>
                      <th className="px-3 py-2 text-center font-semibold text-indigo-700">Total jours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeSummary.map(summary => (
                      <tr key={summary.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{summary.name}</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-semibold">{summary.totalPresent}</td>
                        <td className="px-3 py-2 text-center text-red-600 font-semibold">{summary.totalAbsent}</td>
                        <td className="px-3 py-2 text-center text-yellow-600 font-semibold">{summary.totalVac}</td>
                        <td className="px-3 py-2 text-center text-amber-600 font-semibold">{summary.totalLate}</td>
                        <td className="px-3 py-2 text-center text-orange-600 font-semibold">{summary.totalOff}</td>
                        <td className="px-3 py-2 text-center text-indigo-600 font-bold">{summary.totalDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button onClick={handleExportExcel} disabled={filteredEmployees.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel avec résumé
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}