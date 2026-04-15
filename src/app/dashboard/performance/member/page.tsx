'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp, Activity, Clock, Target, Calendar, Trophy, Medal, Award, User,
  ArrowUpRight, ArrowDownRight, CheckCircle2
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

interface PerformanceData {
  userId: string
  name: string
  jobRole: string
  projectCount: number
  totalMinutes: number
  objectif: number
  ecart: number
  moyenneJour: number
  rang: number
  totalMembres: number
}

interface DailyData {
  date: string
  label: string
  byMember: Record<string, { minutes: number; count: number }>
}

export default function MemberPerformance() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [performance, setPerformance] = useState<PerformanceData[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [teamStats, setTeamStats] = useState({ totalMinutes: 0, objectif: 0, pourcentage: 0 })
  const [myPerformance, setMyPerformance] = useState<PerformanceData | null>(null)
  const [myRank, setMyRank] = useState<number>(0)
  const [totalMembers, setTotalMembers] = useState<number>(0)

  const isLoading = status === 'loading' || loading
  const user = session?.user as any
  const isMember = user?.role === 'MEMBER'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchPerformance = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      
      const params = new URLSearchParams({ period })
      if (period === 'custom' && dateFrom && dateTo) {
        params.set('dateFrom', dateFrom)
        params.set('dateTo', dateTo)
      }
      if (isMember) {
        params.set('memberId', user.id)
        params.set('includeTeam', 'true')
      }
      
      const res = await fetch(`/api/projects/performance?${params.toString()}`)
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      
      setPerformance(data.performanceByMember || [])
      setDailyData(data.dailyPerformance || [])
      setTeamStats(data.teamStats || { totalMinutes: 0, objectif: 0, pourcentage: 0 })
      
      if (isMember && user.id) {
        const myStats = data.myStats || data.performanceByMember?.find((m: PerformanceData) => m.userId === user.id)
        
        if (myStats) {
          setMyPerformance(myStats)
          setMyRank(myStats.rang)
          setTotalMembers(data.performanceByMember?.length || 0)
        } else {
          setMyPerformance({
            userId: user.id,
            name: user.name || 'Unknown',
            jobRole: user.jobRole || '',
            projectCount: 0,
            totalMinutes: 0,
            objectif: 1000,
            ecart: -1000,
            moyenneJour: 0,
            rang: 0,
            totalMembres: data.performanceByMember?.length || 0
          })
          setTotalMembers(data.performanceByMember?.length || 0)
        }
      }
    } catch (err) {
      console.error('Error:', err)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [period, dateFrom, dateTo, isMember, user?.id])

  useEffect(() => {
    if (status === 'authenticated' && user) {
      fetchPerformance()
    }
  }, [status, user, fetchPerformance])

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-100'
    if (minutes < 100) return 'bg-red-200'
    if (minutes < 200) return 'bg-orange-200'
    return 'bg-emerald-200'
  }

  const getRankBadge = (rang: number) => {
    if (rang === 1) return <><Trophy className="w-5 h-5 text-yellow-500 inline" /> 1er</>
    if (rang === 2) return <><Medal className="w-5 h-5 text-gray-400 inline" /> 2ème</>
    if (rang === 3) return <><Award className="w-5 h-5 text-amber-600 inline" /> 3ème</>
    return `${rang}ème`
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (status === 'unauthenticated' || !user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="h-6 w-6 text-indigo-600" />
            Ma Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.name} • {
              myPerformance?.jobRole === 'REDACTEUR' ? 'Rédaction' : 
              myPerformance?.jobRole === 'TECH_SON' ? 'Mixage' : 
              myPerformance?.jobRole === 'NARRATEUR' ? 'Narration' : 
              'Performance'
            } • {
              period === 'week' ? 'Cette semaine' : 
              period === 'month' ? 'Ce mois' : 
              period === 'year' ? 'Cette année' : 
              'Personnalisé'
            }
          </p>
        </div>

        {/* FILTRES */}
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-2 py-2 text-sm" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-2 py-2 text-sm" />
            </>
          )}

          <button onClick={fetchPerformance} disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {isLoading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {/* STATS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Minutes réalisées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-indigo-600">{myPerformance?.totalMinutes || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Objectif {myPerformance?.jobRole === 'TECH_SON' && '(Mixage)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {myPerformance?.objectif || 0} min
                <span className="text-xs text-slate-400 block mt-1">
                  {myPerformance?.jobRole === 'TECH_SON' ? '167 min/jour' : '200 min/jour'}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Écart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold flex items-center gap-1 ${
                (myPerformance?.ecart || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {(myPerformance?.ecart || 0) >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                {(myPerformance?.ecart || 0) >= 0 ? '+' : ''}{myPerformance?.ecart || 0} min
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Classement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {getRankBadge(myRank)} <span className="text-sm text-slate-400">/ {totalMembers}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* PROGRESSION */}
        <Card className="border-indigo-200 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Progression vs Objectif
              </CardTitle>
              <Badge className={
                teamStats.pourcentage >= 100 ? 'bg-emerald-100 text-emerald-700' :
                teamStats.pourcentage >= 80 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }>
                {teamStats.pourcentage}% atteint
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="relative">
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      teamStats.pourcentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      teamStats.pourcentage >= 80 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${Math.min(teamStats.pourcentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Objectif</p>
                  <p className="text-lg font-bold text-slate-700">{myPerformance?.objectif || 0} min</p>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-indigo-500 mb-1">Réalisé</p>
                  <p className="text-lg font-bold text-indigo-700">{myPerformance?.totalMinutes || 0} min</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Moyenne/jour</p>
                  <p className="text-lg font-bold text-slate-700">{myPerformance?.moyenneJour || 0} min</p>
                </div>
              </div>

              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                teamStats.pourcentage >= 100 ? 'bg-emerald-50 text-emerald-700' :
                teamStats.pourcentage >= 80 ? 'bg-yellow-50 text-yellow-700' :
                teamStats.pourcentage >= 50 ? 'bg-orange-50 text-orange-700' :
                'bg-red-50 text-red-700'
              }`}>
                {teamStats.pourcentage >= 100 ? <CheckCircle2 className="w-5 h-5" /> :
                 teamStats.pourcentage >= 80 ? <TrendingUp className="w-5 h-5" /> :
                 <Activity className="w-5 h-5" />}
                <span className="font-medium text-sm">
                  {teamStats.pourcentage >= 100 ? '🎉 Objectif atteint ! Félicitations !' :
                   teamStats.pourcentage >= 80 ? '⚠️ Presque là ! Encore un effort !' :
                   teamStats.pourcentage >= 50 ? '📈 En bonne voie, continuez !' :
                   '🔴 Retard important, motivez-vous !'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CLASSEMENT */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-600" />
            Classement de l'équipe {myPerformance?.jobRole === 'REDACTEUR' ? 'Rédaction' : 'Mixage'}
          </h3>
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Rang</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Membre</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Projets</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Minutes</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Objectif</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Écart</th>
                </tr>
              </thead>
              <tbody>
                {performance.map(m => (
                  <tr 
                    key={m.userId} 
                    className={`border-t transition-colors ${
                      m.userId === user?.id 
                        ? 'bg-indigo-50 border-indigo-200' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      {m.rang === 1 ? '🥇' : m.rang === 2 ? '🥈' : m.rang === 3 ? '🥉' : 
                       <span className="text-slate-400">{m.rang}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.userId === user?.id && (
                          <Badge className="bg-indigo-600 text-white text-[10px]">Moi</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-xs bg-slate-50">
                        {m.projectCount} projets
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold text-indigo-600">{m.totalMinutes}</span>
                      <span className="text-xs text-slate-400 ml-1">min</span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500">{m.objectif}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={
                        m.ecart >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }>
                        {m.ecart >= 0 ? '+' : ''}{m.ecart}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {performance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucune donnée pour cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTIVITÉ PAR JOUR */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Mon activité par jour
          </h3>
          <div className="bg-white rounded-xl border overflow-x-auto p-4 shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 sticky left-0 bg-white">Moi</th>
                  {dailyData.map(d => (
                    <th key={d.date} className="text-center py-2 px-2 font-medium text-slate-600">
                      {d.label}
                    </th>
                  ))}
                  <th className="text-center py-2 px-3 font-medium text-slate-600 bg-indigo-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {performance.filter(m => m.userId === user?.id).map(m => (
                  <tr key={m.userId} className="border-t">
                    <td className="py-2 px-3 font-medium sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <Badge className="bg-indigo-600 text-white text-[10px]">Moi</Badge>
                      </div>
                    </td>
                    {dailyData.map(d => {
                      const mins = d.byMember[m.userId]?.minutes || 0
                      return (
                        <td
                          key={d.date}
                          className={`py-2 px-2 text-center ${getHeatmapColor(mins)}`}
                          title={`${mins} min`}
                        >
                          {mins > 0 ? mins : '-'}
                        </td>
                      )
                    })}
                    <td className="py-2 px-3 text-center font-semibold bg-indigo-50">
                      {m.totalMinutes} min
                    </td>
                  </tr>
                ))}
                {performance.filter(m => m.userId === user?.id).length === 0 && (
                  <tr>
                    <td colSpan={dailyData.length + 2} className="py-8 text-center text-slate-400">
                      Aucune activité pour cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Légende (min/jour) :</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-100 rounded" /><span>0</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 rounded" /><span>&lt;100</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 rounded" /><span>100-200 (objectif)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-200 rounded" /><span>&gt;200</span>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}