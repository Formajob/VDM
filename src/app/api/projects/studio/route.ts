// src/app/api/projects/studio/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const techSonId = searchParams.get('techSonId') || 'all'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const userJobRole = (session.user as any).jobRole
    const isAdmin = userRole === 'ADMIN'

    // ✅ Admin + Tech Son + Narrateur + Livreur
    if (!isAdmin && !['TECH_SON', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
      return NextResponse.json({ error: 'Accès réservé au studio' }, { status: 403 })
    }

    // ✅ CORRECTION 1: Projects finis en rédaction (DISPATCH ou REDACTION)
    let query = supabaseAdmin
      .from('Project')
      .select('*')
      .in('workflowStep', ['DISPATCH', 'REDACTION'])
      .eq('status', 'FAIT')
      .order('createdAt', { ascending: false })

    // ✅ CORRECTION 2: Tech Son voit TOUS les projets (pas filtré par redacteurId)
    // Seul le filtre techSonId s'applique si spécifié
    if (!isAdmin && techSonId === 'all') {
      // Tech Son voit seulement les projets qui lui sont assignés OU non assignés
      query = query.or(`techSonId.is.null,techSonId.eq.${userId}`)
    } else if (!isAdmin && techSonId !== 'all') {
      query = query.eq('techSonId', techSonId)
    }
    // Admin voit tout (pas de filtre)

    // ✅ Filtrer par mixStatus
    if (status === 'en_attente') {
      query = query.is('techSonId', null).eq('mixStatus', 'PAS_ENCORE')
    } else if (status === 'en_cours') {
      query = query.not('techSonId', 'is', null).eq('mixStatus', 'EN_COURS')
    } else if (status === 'fait') {
      query = query.eq('mixStatus', 'FAIT')
    } else if (status === 'signale') {
      query = query.eq('mixStatus', 'SIGNALE')
    }

    if (dateFrom) query = query.gte('createdAt', dateFrom)
    if (dateTo) query = query.lte('createdAt', dateTo)

    // ✅ CORRECTION 3: data: projects
    const {  data: projects, error } = await query

    if (error) {
      console.error('❌ Studio projects error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const redacteurIds = [...new Set(projects?.map((p: any) => p.redacteurId).filter(Boolean))]
    const techSonIds = [...new Set(projects?.map((p: any) => p.techSonId).filter(Boolean))]

    let redacteurs: any[] = []
    let techSons: any[] = []

    if (redacteurIds.length > 0) {
      const {   data:redactData } = await supabaseAdmin
        .from('User').select('id, name').in('id', redacteurIds)
      redacteurs = redactData || []
    }

    if (techSonIds.length > 0) {
      const {   data:techData } = await supabaseAdmin
        .from('User').select('id, name').in('id', techSonIds)
      techSons = techData || []
    }

    const projectsWithUsers = projects?.map((p: any) => ({
      ...p,
      User: redacteurs.find((u: any) => u.id === p.redacteurId),
      User_1: techSons.find((u: any) => u.id === p.techSonId)
    }))

    const stats = {
      total: projectsWithUsers?.length || 0,
      en_attente: projectsWithUsers?.filter((p: any) => !p.techSonId).length || 0,
      en_cours: projectsWithUsers?.filter((p: any) => p.mixStatus === 'EN_COURS').length || 0,
      fait: projectsWithUsers?.filter((p: any) => p.mixStatus === 'FAIT').length || 0,
      signale: projectsWithUsers?.filter((p: any) => p.mixStatus === 'SIGNALE').length || 0,
    }

    return NextResponse.json({ 
      projects: projectsWithUsers || [], 
      stats,
      isAdmin
    })
  } catch (e: any) {
    console.error('❌ Studio API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectId, action, techSonId, comment } = body
    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const isAdmin = userRole === 'ADMIN'

    console.log('🔍 [STUDIO API] Action:', action, 'ProjectId:', projectId, 'TechSonId:', techSonId)

    if (action === 'commencer') {
      // ✅ CORRECTION 4: Admin doit passer techSonId, sinon c'est userId
      const assignTechSonId = isAdmin && techSonId ? techSonId : userId
      
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          techSonId: assignTechSonId,
          mixStatus: 'EN_COURS',
          mixStartedAt: new Date().toISOString(),
          comment: comment || null
        })
        .eq('id', projectId)
      
      console.log('🔄 [STUDIO API] Commencer result:', { error, assignTechSonId })
      if (error) throw error
      
    } else if (action === 'fait') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          mixStatus: 'FAIT',
          mixDoneAt: new Date().toISOString(),
          comment: comment || null,
          isMixed: true,  // ← ← ← IMPORTANT pour Performance
          mixedAt: new Date().toISOString(),
          workflowStep: 'REDACTION'
        })
        .eq('id', projectId)
      
      console.log('🔄 [STUDIO API] Fait result:', { error, projectId })
      if (error) throw error
      
    } else if (action === 'signaler') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          mixStatus: 'SIGNALE',
          comment: comment || 'Problème signalé'
        })
        .eq('id', projectId)
      if (error) throw error
      
    } else if (action === 'saveComment') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({ comment: comment || null })
        .eq('id', projectId)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ Studio update error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}