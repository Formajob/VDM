// src/app/api/projects/livraison/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: Récupérer les projets prêts pour livraison
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userRole = (session.user as any).role
    const userJobRole = (session.user as any).jobRole
    const userId = (session.user as any).id
    const isAdmin = userRole === 'ADMIN'
    const isLivreur = userJobRole === 'LIVREUR'

    if (!isAdmin && !isLivreur) {
      return NextResponse.json({ error: 'Accès réservé' }, { status: 403 })
    }

    const {  data:projects, error } = await supabaseAdmin
      .from('Project')
      .select(`
        *,
        User:redacteurId (id, name),
        User_1:techSonId (id, name)
      `)
      .eq('mixStatus', 'FAIT')  // ✅ Uniquement mixage terminé
      .order('deadline', { ascending: true })

    if (error) throw error

    return NextResponse.json({ projects: projects || [] })
  } catch (e: any) {
    console.error('❌ [LIVRAISON API] GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: Actions sur les projets (conforme, signaler, livrer)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectId, action, comment, returnType, deliveryStatus, deliveredAt } = body

    // ✅ Action: Marquer comme conforme
    if (action === 'conforme') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          deliveryStatus: 'CONFORME',
          updatedAt: new Date().toISOString()
        })
        .eq('id', projectId)

      if (error) throw error
      console.log('✅ Projet marqué conforme:', projectId)
      
    // ✅ Action: Signaler problème (retour studio ou redaction)
    } else if (action === 'signaler') {
      const updateData: any = {
        comment: comment || null,
        updatedAt: new Date().toISOString()
      }

      if (returnType === 'redaction') {
        // Retour à la rédaction
        updateData.status = 'PAS_ENCORE'
        updateData.workflowStep = 'REDACTION'
        updateData.redactionReturns = await supabaseAdmin
          .from('Project')
          .select('redactionReturns')
          .eq('id', projectId)
          .single()
          .then(({ data }: any) => (data?.redactionReturns || 0) + 1)
      } else {
        // Retour au studio (mixage)
        updateData.mixStatus = 'PAS_ENCORE'
        updateData.workflowStep = 'STUDIO'
        updateData.mixageReturns = await supabaseAdmin
          .from('Project')
          .select('mixageReturns')
          .eq('id', projectId)
          .single()
          .then(({ data }: any) => (data?.mixageReturns || 0) + 1)
      }

      const { error } = await supabaseAdmin
        .from('Project')
        .update(updateData)
        .eq('id', projectId)

      if (error) throw error
      console.log('✅ Projet signalé et retourné:', projectId, 'à', returnType)
      
    // ✅ Action: Livrer projet
    } else if (action === 'livrer') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          deliveredAt: deliveredAt || new Date().toISOString(),
          workflowStep: 'TERMINE',
          updatedAt: new Date().toISOString()
        })
        .eq('id', projectId)

      if (error) throw error
      console.log('✅ Projet livré:', projectId)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ [LIVRAISON API] PATCH error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}