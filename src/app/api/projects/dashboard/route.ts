// src/app/api/projects/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''
    const period = searchParams.get('period') || 'month'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const year = searchParams.get('year')

    // ✅ Calculer la période
    const now = new Date()
    let startDate: string, endDate: string
    
    if (period === 'custom' && dateFrom && dateTo) {
      startDate = dateFrom
      endDate = dateTo
    } else if (period === 'today') {
      startDate = now.toISOString().split('T')[0]
      endDate = startDate
    } else if (period === 'week') {
      const day = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - day + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      startDate = monday.toISOString().split('T')[0]
      endDate = sunday.toISOString().split('T')[0]
    } else if (period === 'year' && year) {
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`
    } else {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      endDate = now.toISOString().split('T')[0]
    }

    // ✅ Stats globales
    const [
      { count: totalProjects },
      { count: receivedThisPeriod },
      { count: deliveredThisPeriod },
      { count: inProgress }
    ] = await Promise.all([
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).gte('createdAt', startDate).lte('createdAt', endDate),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).eq('workflowStep', 'LIVRE'),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).in('workflowStep', ['REDACTION', 'STUDIO', 'LIVRAISON'])
    ])

    // ✅ Minutes
    const [
      { data: receivedProjects },
      { data: deliveredProjects }
    ] = await Promise.all([
      supabaseAdmin.from('Project').select('durationMin').gte('createdAt', startDate).lte('createdAt', endDate),
      supabaseAdmin.from('Project').select('durationMin').eq('workflowStep', 'LIVRE')
    ])

    const totalMinutesReceived = receivedProjects?.reduce((sum, p) => sum + (p.durationMin || 0), 0) || 0
    const totalMinutesDelivered = deliveredProjects?.reduce((sum, p) => sum + (p.durationMin || 0), 0) || 0

    // ✅ Alertes
    const alertsData = await supabaseAdmin
      .from('Project')
      .select('id, name, seriesName, deadline, workflowStep, status')
      .or(`deadline.lt.${endDate},status.eq.RETOUR_REDACTION,status.eq.RETOUR_MIXAGE`)

    const alerts = {
      retard: alertsData.data?.filter(p => new Date(p.deadline) < now) || [],
      echeanceProche: alertsData.data?.filter(p => {
        const deadline = new Date(p.deadline)
        const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        return diffDays >= 0 && diffDays <= 7
      }) || [],
      retourQC: alertsData.data?.filter(p => p.status === 'RETOUR_REDACTION' || p.status === 'RETOUR_MIXAGE') || []
    }

    // ✅ PERFORMANCE PAR ÉQUIPE — Statut "FAIT" pour Rédaction/Studio
    const { data: allUsers } = await supabaseAdmin
      .from('User')
      .select('id, name, jobRole')
      .eq('role', 'MEMBER')
      .eq('isActive', true)

    const { data: performanceProjects } = await supabaseAdmin
      .from('Project')
      .select('id, durationMin, redacteurId, workflowStep, status, createdAt')
      .or(`and(workflowStep.eq.REDACTION,status.eq.FAIT),and(workflowStep.eq.STUDIO,status.eq.FAIT),and(workflowStep.eq.LIVRAISON,status.eq.LIVRE)`)
      .gte('createdAt', startDate)
      .lte('createdAt', endDate)

    const performanceByRole: Record<string, { count: number; minutes: number; members: Record<string, number> }> = {}
    
    performanceProjects?.forEach(p => {
      let jobRole: string | undefined
      if (p.workflowStep === 'REDACTION' && p.status === 'FAIT') jobRole = 'REDACTEUR'
      else if (p.workflowStep === 'STUDIO' && p.status === 'FAIT') jobRole = 'TECH_SON'
      else if (p.workflowStep === 'LIVRAISON' && p.status === 'LIVRE') jobRole = 'LIVREUR'
      
      if (jobRole) {
        const user = allUsers?.find(u => u.id === p.redacteurId)
        if (user) {
          if (!performanceByRole[jobRole]) {
            performanceByRole[jobRole] = { count: 0, minutes: 0, members: {} }
          }
          performanceByRole[jobRole].count += 1
          performanceByRole[jobRole].minutes += p.durationMin || 0
          if (!performanceByRole[jobRole].members[user.name]) {
            performanceByRole[jobRole].members[user.name] = 0
          }
          performanceByRole[jobRole].members[user.name] += p.durationMin || 0
        }
      }
    })

    const teamPerformance = Object.entries(performanceByRole).map(([role, data]) => {
      const topMember = Object.entries(data.members).sort(([,a], [,b]) => b - a)[0]
      const avgMinutes = data.count > 0 ? Math.round(data.minutes / data.count) : 0
      return {
        role,
        count: data.count,
        totalMinutes: data.minutes,
        avgMinutes,
        topMember: topMember ? { name: topMember[0], minutes: topMember[1] } : null,
        members: Object.entries(data.members).map(([name, minutes]) => ({ name, minutes }))
      }
    })

    // ✅ VUE ANNUELLE — Stats par mois
    let monthlyStats: Array<{ month: string; count: number; minutes: number }> = []
    if (period === 'year' && year) {
      const { data: yearProjects } = await supabaseAdmin
        .from('Project')
        .select('durationMin, createdAt, workflowStep, status')
        .gte('createdAt', `${year}-01-01`)
        .lte('createdAt', `${year}-12-31`)
      
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0')
        return { month: `${year}-${m}`, count: 0, minutes: 0 }
      })
      
      yearProjects?.forEach(p => {
        const monthKey = p.createdAt?.split('T')[0].slice(0, 7)
        const monthIdx = months.findIndex(m => m.month === monthKey)
        if (monthIdx >= 0 && (p.status === 'FAIT' || p.workflowStep === 'LIVRE')) {
          months[monthIdx].count += 1
          months[monthIdx].minutes += p.durationMin || 0
        }
      })
      monthlyStats = months.filter(m => m.count > 0)
    }

    // ✅ Recherche
    let searchResults: any[] = []
    if (query) {
      const { data: results } = await supabaseAdmin
        .from('Project')
        .select('id, name, seriesName, season, episodeNumber, broadcastChannel, deadline, durationMin, workflowStep, status, redacteurId, comment, startDate')
        .or(`name.ilike.%${query}%,seriesName.ilike.%${query}%,broadcastChannel.ilike.%${query}%,comment.ilike.%${query}%`)
        .order('createdAt', { ascending: false })
        .limit(50)
      searchResults = results || []
    }

    return NextResponse.json({
      stats: {
        totalProjects: totalProjects || 0,
        receivedThisPeriod: receivedThisPeriod || 0,
        deliveredThisPeriod: deliveredThisPeriod || 0,
        inProgress: inProgress || 0,
        totalMinutesReceived,
        totalMinutesDelivered,
        period: { startDate, endDate }
      },
      alerts: {
        retard: alerts.retard.map(p => ({ id: p.id, name: p.seriesName, deadline: p.deadline, type: 'RETARD' as const })),
        echeanceProche: alerts.echeanceProche.map(p => ({ id: p.id, name: p.seriesName, deadline: p.deadline, type: 'ECHEANCE_7J' as const })),
        retourQC: alerts.retourQC.map(p => ({ id: p.id, name: p.seriesName, status: p.status, type: 'RETOUR_QC' as const }))
      },
      performance: teamPerformance,
      monthlyStats,
      searchResults
    })
  } catch (e: any) {
    console.error('❌ Dashboard API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}