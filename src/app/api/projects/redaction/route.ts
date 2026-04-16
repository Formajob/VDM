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
    const sortBy = searchParams.get('sortBy') || 'deadline'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const isAdmin = userRole === 'ADMIN'

    // ✅ CORRECTION 1: Inclure DISPATCH ET REDACTION
  let query = supabaseAdmin
  .from('Project')
  .select('*')
  .in('workflowStep', ['DISPATCH', 'REDACTION'])  // ✅ CORRECTION: Les deux
  .order(sortBy === 'deadline' ? 'deadline' : 'createdAt', { ascending: sortOrder === 'asc' })

    if (!isAdmin) {
      query = query.eq('redacteurId', userId)
    }

    // ✅ Filtrer par statut
    if (status === 'pas_encore') {
      query = query.eq('status', 'PAS_ENCORE')
    } else if (status === 'en_cours') {
      query = query.eq('status', 'EN_COURS')
    } else if (status === 'fait') {
      query = query.eq('status', 'FAIT')
    } else if (status === 'signale') {
      query = query.eq('vsStatus', 'SIGNALE')
    }

    if (dateFrom) query = query.gte('createdAt', dateFrom)
    if (dateTo) query = query.lte('createdAt', dateTo)

    const { data: projects, error } = await query

    if (error) {
      console.error('❌ Redaction projects error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const stats = {
      total: projects?.length || 0,
      pas_encore: projects?.filter((p: any) => p.status === 'PAS_ENCORE').length || 0,
      en_cours: projects?.filter((p: any) => p.status === 'EN_COURS').length || 0,
      fait: projects?.filter((p: any) => p.status === 'FAIT').length || 0,
      signale: projects?.filter((p: any) => p.vsStatus === 'SIGNALE').length || 0,
    }

    return NextResponse.json({ 
      projects: projects || [], 
      stats,
      isAdmin
    })
  } catch (e: any) {
    console.error('❌ Redaction API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// src/app/api/projects/redaction/route.ts

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectId, action, pageCount, comment, writtenAt } = body
    const userId = (session.user as any).id

    console.log('🔍 [REDACTION API] Action:', action, 'ProjectId:', projectId)

    if (action === 'commencer') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          status: 'EN_COURS',
          startDate: new Date().toISOString(),
          comment: comment || null
        })
        .eq('id', projectId)
      
      console.log('🔄 [REDACTION API] Commencer result:', { error })
      if (error) throw error
      
    } else if (action === 'completer') {
      // ✅ CORRECTION: NE PAS inclure durationMin dans l'update
      // durationMin doit déjà exister dans la DB (défini au dispatch)
      const { error } = await supabaseAdmin
        .from('Project')
        .update({
          status: 'FAIT',
          pageCount: pageCount !== undefined ? pageCount : null,
          comment: comment !== undefined ? comment : null,
          isWritten: true,
          writtenAt: writtenAt ? new Date(writtenAt).toISOString() : new Date().toISOString(),
          workflowStep: 'REDACTION'
          // ⚠️ durationMin N'EST PAS ICI - on ne la modifie pas
        })
        .eq('id', projectId)
      
      console.log('🔄 [REDACTION API] Compléter result:', { error, projectId })
      if (error) throw error
      
    } else if (action === 'saveComment') {
      const { error } = await supabaseAdmin
        .from('Project')
        .update({ comment: comment !== undefined ? comment : null })
        .eq('id', projectId)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ Redaction update error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectId, status, pageCount, writtenAt, comment } = body

    console.log('🔍 [REDACTION API] PATCH:', projectId, writtenAt)

    const { error } = await supabaseAdmin
      .from('Project')
      .update({
        status: status || null,
        pageCount: pageCount !== undefined ? pageCount : null,
        writtenAt: writtenAt ? new Date(writtenAt).toISOString() : null,
        comment: comment !== undefined ? comment : null,
        isWritten: status === 'FAIT' ? true : undefined,
        workflowStep: status === 'FAIT' ? 'REDACTION' : undefined
      })
      .eq('id', projectId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ Redaction PATCH error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}