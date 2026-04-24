// src/app/api/projects/redaction/route.ts
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

    console.log('🔍 [REDACTION API] User:', { userId, userRole, userJobRole, isAdmin })

    // ✅ Admin + Redacteur + Narrateur + Livreur
    if (!isAdmin && !['REDACTEUR', 'NARRATEUR', 'LIVREUR'].includes(userJobRole)) {
      return NextResponse.json({ error: 'Accès réservé à la rédaction' }, { status: 403 })
    }

    // ✅ Requête - TOUS les projets avec workflowStep approprié
    let query = supabaseAdmin
      .from('Project')
      .select(`
        *,
        User:redacteurId (id, name),
        User_1:techSonId (id, name)
      `)

    // ✅ Filtrer par workflowStep pour la rédaction
    query = query.in('workflowStep', ['DISPATCH', 'REDACTION', 'STUDIO', 'LIVRAISON'])
    
    // ✅ Si pas admin et Redacteur, filtrer par redacteurId
    if (!isAdmin && userJobRole === 'REDACTEUR') {
      query = query.eq('redacteurId', userId)
    }

    // ✅ Filtrer par status de rédaction
    if (status === 'pas_encore') {
      query = query.eq('status', 'PAS_ENCORE')
    } else if (status === 'en_cours') {
      query = query.eq('status', 'EN_COURS')
    } else if (status === 'fait') {
      query = query.eq('status', 'FAIT')
    }
    // Si status = 'all', ne pas filtrer par status

    console.log('🔍 [REDACTION API] Query:', { status, workflowStep: ['DISPATCH', 'REDACTION', 'STUDIO', 'LIVRAISON'] })

    const {  data:projects, error } = await query

    if (error) {
      console.error('❌ [REDACTION API] Error:', error)
      return NextResponse.json({ error: error.message, projects: [] }, { status: 500 })
    }

    console.log('📊 [REDACTION API] Projects found:', projects?.length, 'User:', userJobRole)

    // ✅ Calculer les stats
    const stats = {
      total: projects?.length || 0,
      pas_encore: projects?.filter((p: any) => p.status === 'PAS_ENCORE').length || 0,
      en_cours: projects?.filter((p: any) => p.status === 'EN_COURS').length || 0,
      fait: projects?.filter((p: any) => p.status === 'FAIT').length || 0,
      en_retard: projects?.filter((p: any) => {
        if (!p.deadline) return false
        return new Date(p.deadline) < new Date() && p.status !== 'FAIT'
      }).length || 0,
    }

    return NextResponse.json({ projects: projects || [], stats })
  } catch (e: any) {
    console.error('❌ [REDACTION API] Error:', e)
    return NextResponse.json({ error: e.message, projects: [] }, { status: 500 })
  }
}

// src/app/api/projects/redaction/route.ts

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectId, action, comment, status, writtenAt, pageCount, durationMin, redacteurId } = body  // ✅ Ajouter redacteurId
    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const isAdmin = userRole === 'ADMIN'

    console.log('🔍 [REDACTION API] POST:', { action, projectId, isAdmin })

    // ✅ Action: Réassigner à un autre rédacteur (Admin seulement)
    if (action === 'reassign') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 403 })
      }
      if (!redacteurId) {
        return NextResponse.json({ error: 'Nouveau rédacteur requis' }, { status: 400 })
      }

      // Vérifier que le rédacteur existe
      const { data:writer } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('id', redacteurId)
        .eq('jobRole', 'REDACTEUR')
        .single()
      
      if (!writer) {
        return NextResponse.json({ error: 'Rédacteur invalide' }, { status: 400 })
      }

      // Mettre à jour le redacteurId du projet
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          redacteurId: redacteurId,
          updatedAt: new Date().toISOString()
        })
        .eq('id', projectId)
      
      if (error) {
        console.error('❌ [REDACTION API] Error reassign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      console.log('✅ [REDACTION API] Project reassigned:', projectId, 'to', redacteurId)
      return NextResponse.json({ success: true })
    }

    // ✅ Action: Commencer la rédaction
    if (action === 'commencer') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          status: 'EN_COURS',
          comment: comment || null
        })
        .eq('id', projectId)
      
      if (error) {
        console.error('❌ [REDACTION API] Error commencer:', error)
        throw error
      }
      console.log('✅ [REDACTION API] Projet commencé:', projectId)
      
    // ✅ Action: Marquer comme fait
    } else if (action === 'fait') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          status: 'FAIT',
          writtenAt: new Date().toISOString(),
          isWritten: true,
          comment: comment || null,
          workflowStep: 'STUDIO'
        })
        .eq('id', projectId)
      
      if (error) {
        console.error('❌ [REDACTION API] Error fait:', error)
        throw error
      }
      console.log('✅ [REDACTION API] Projet fait:', projectId)
      
    // ✅ Action: Signaler un problème
    } else if (action === 'signaler') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          status: 'SIGNALE',
          comment: comment || 'Problème signalé'
        })
        .eq('id', projectId)
      
      if (error) {
        console.error('❌ [REDACTION API] Error signaler:', error)
        throw error
      }
      console.log('✅ [REDACTION API] Projet signalé:', projectId)
      
    // ✅ Action: Modifier un projet (Admin seulement)
} else if (action === 'update') {
  if (!isAdmin) {
    return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 403 })
  }
  
  const updateData: any = {}
  
  if (status) updateData.status = status
  
  // ✅ CORRECTION: Accepter writtenAt null pour effacer la date
  if (writtenAt !== undefined) {
    updateData.writtenAt = writtenAt || null  // Si vide string, convertir à null
  }
  
  if (pageCount !== undefined) updateData.pageCount = pageCount
  if (durationMin !== undefined) updateData.durationMin = durationMin
  if (comment !== undefined) updateData.comment = comment
  
  console.log('🔧 [REDACTION API] Update ', updateData)
  
  const { error } = await supabaseAdmin
    .from('Project')
    .update(updateData)
    .eq('id', projectId)
  
  if (error) {
    console.error('❌ [REDACTION API] Error update:', error)
    throw error
  }
  console.log('✅ [REDACTION API] Projet modifié:', projectId)
}

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ [REDACTION API] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}