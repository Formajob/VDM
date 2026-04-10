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

    // ✅ Calculer la période
    const now = new Date()
    const startDate = period === 'week' 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const endDate = now.toISOString().split('T')[0]

    // ✅ Stats globales
    const [
      { count: totalProjects },
      { count: receivedThisPeriod },
      { count: deliveredThisPeriod },
      { count: inProgress }
    ] = await Promise.all([
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).gte('createdAt', startDate),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).eq('workflowStep', 'LIVRE'),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).in('workflowStep', ['REDACTION', 'STUDIO', 'LIVRAISON'])
    ])

    // ✅ Calculer les minutes
    const [
      { data: receivedProjects },
      { data: deliveredProjects }
    ] = await Promise.all([
      supabaseAdmin.from('Project').select('durationMin').gte('createdAt', startDate),
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

    // ✅ Recherche globale si query fournie
    let searchResults: any[] = [] 
    if (query) {
      const { data: results } = await supabaseAdmin
        .from('Project')
        .select('id, name, seriesName, deadline, durationMin, workflowStep')
        .or(`name.ilike.%${query}%,seriesName.ilike.%${query}%`)
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
      searchResults
    })
  } catch (e: any) {
    console.error('❌ Dashboard API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}