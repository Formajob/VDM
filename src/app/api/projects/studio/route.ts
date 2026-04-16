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
    const userJobRole = (session.user as any).jobRole

    if (!['TECH_SON', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
      return NextResponse.json({ error: 'Accès réservé au studio' }, { status: 403 })
    }

    // ✅ Filtrer: workflowStep = REDACTION + status = FAIT
    let query = supabaseAdmin
      .from('Project')
      .select('*')
      .eq('workflowStep', 'REDACTION')
      .eq('status', 'FAIT')
      .order('createdAt', { ascending: false })

    // ✅ Filtrer par mixStatus (colonnes de ton schéma nettoyé)
    if (status === 'en_attente') {
      query = query.is('techSonId', null).eq('mixStatus', 'PAS_ENCORE')
    } else if (status === 'en_cours') {
      query = query.not('techSonId', 'is', null).eq('mixStatus', 'EN_COURS')
    } else if (status === 'fait') {
      query = query.eq('mixStatus', 'FAIT')
    } else if (status === 'signale') {
      query = query.eq('mixStatus', 'SIGNALE')
    }

    if (techSonId !== 'all') {
      query = query.eq('techSonId', techSonId)
    }

    if (dateFrom) query = query.gte('createdAt', dateFrom)
    if (dateTo) query = query.lte('createdAt', dateTo)

    const {  data:projects, error } = await query

    if (error) {
      console.error('❌ Studio projects error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const redacteurIds = [...new Set(projects?.map((p: any) => p.redacteurId).filter(Boolean))]
    const techSonIds = [...new Set(projects?.map((p: any) => p.techSonId).filter(Boolean))]

    let redacteurs: any[] = []
    let techSons: any[] = []

    if (redacteurIds.length > 0) {
      const {  data:redactData } = await supabaseAdmin
        .from('User').select('id, name').in('id', redacteurIds)
      redacteurs = redactData || []
    }

    if (techSonIds.length > 0) {
      const {  data:techData } = await supabaseAdmin
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

    return NextResponse.json({ projects: projectsWithUsers || [], stats })
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
    const { projectId, action, comment } = body
    const userId = (session.user as any).id

    console.log('🔍 [STUDIO API] Action:', action, 'ProjectId:', projectId)

    if (action === 'commencer') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          techSonId: userId,
          mixStatus: 'EN_COURS',
          mixStartedAt: new Date().toISOString(),
          comment: comment || null
        })
        .eq('id', projectId)
      
      console.log('🔄 [STUDIO API] Commencer result:', { error })
      if (error) throw error
      
    } else if (action === 'fait') {
      console.log('🔄 [STUDIO API] Updating project to FAIT:', projectId)
      
      // ✅ CORRECTION: Utiliser mixedAt (pas mixDoneAt) et NE PAS changer workflowStep
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          mixStatus: 'FAIT',
          mixedAt: new Date().toISOString(),  // ← ← ← mixedAt (schéma nettoyé)
          comment: comment || null,
          isMixed: true,  // ← ← ← Pour la performance
          // workflowStep RESTE 'REDACTION' pour que le projet reste dans Studio
        })
        .eq('id', projectId)
      
      console.log('🔄 [STUDIO API] Fait result:', { error, projectId })
      
      if (error) {
        console.error('❌ [STUDIO API] Update error:', error)
        throw error
      }
      
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