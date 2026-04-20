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

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const userJobRole = (session.user as any).jobRole
    const isAdmin = userRole === 'ADMIN'

    console.log('🔍 [STUDIO API] User:', { userId, userRole, userJobRole, isAdmin })

    // ✅ Admin + Tech Son + Narrateur + Livreur
    if (!isAdmin && !['TECH_SON', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
      return NextResponse.json({ error: 'Accès réservé au studio' }, { status: 403 })
    }

    // ✅ CORRECTION: Requête simplifiée - TOUS les projets avec status = FAIT
    let query = supabaseAdmin
      .from('Project')
      .select(`
        *,
        User:redacteurId (id, name),
        User_1:techSonId (id, name)
      `)
      .eq('status', 'FAIT')

    // ✅ CORRECTION: Filtrer par workflowStep (STUDIO ou REDACTION ou LIVRAISON)
    // Les projets en DISPATCH ne sont pas encore en rédaction
    query = query.in('workflowStep', ['REDACTION', 'STUDIO', 'LIVRAISON'])

    // ✅ Filtrer par mixStatus si spécifié
    if (status === 'pas_encore') {
      query = query.eq('mixStatus', 'PAS_ENCORE')
    } else if (status === 'en_attente') {
      query = query.is('techSonId', null).eq('mixStatus', 'PAS_ENCORE')
    } else if (status === 'en_cours') {
      query = query.not('techSonId', 'is', null).eq('mixStatus', 'EN_COURS')
    } else if (status === 'fait') {
      query = query.eq('mixStatus', 'FAIT')
    } else if (status === 'signale') {
      query = query.eq('mixStatus', 'SIGNALE')
    }

    console.log('🔍 [STUDIO API] Query:', { status, workflowStep: ['REDACTION', 'STUDIO', 'LIVRAISON'] })

    const { data: projects, error } = await query

    if (error) {
      console.error('❌ [STUDIO API] Error:', error)
      return NextResponse.json({ error: error.message, projects: [] }, { status: 500 })
    }

    console.log('📊 [STUDIO API] Projects found:', projects?.length, 'User:', userJobRole)

    // ✅ Calculer les stats
    const stats = {
      total: projects?.length || 0,
      pas_encore: projects?.filter((p: any) => p.mixStatus === 'PAS_ENCORE').length || 0,
      en_attente: projects?.filter((p: any) => !p.techSonId && p.mixStatus === 'PAS_ENCORE').length || 0,
      en_cours: projects?.filter((p: any) => p.mixStatus === 'EN_COURS').length || 0,
      fait: projects?.filter((p: any) => p.mixStatus === 'FAIT').length || 0,
      signale: projects?.filter((p: any) => p.mixStatus === 'SIGNALE').length || 0,
    }

    return NextResponse.json({ projects: projects || [], stats })
  } catch (e: any) {
    console.error('❌ [STUDIO API] Error:', e)
    return NextResponse.json({ error: e.message, projects: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectId, action, techSonId, comment } = body
    const userId = (session.user as any).id
    const isAdmin = (session.user as any).role === 'ADMIN'

    if (action === 'commencer') {
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
      
      if (error) throw error
      
    } else if (action === 'fait') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          mixStatus: 'FAIT',
          mixedAt: new Date().toISOString(),
          comment: comment || null,
          isMixed: true,
          workflowStep: 'LIVRAISON'
        })
        .eq('id', projectId)
      
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
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ [STUDIO API] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}