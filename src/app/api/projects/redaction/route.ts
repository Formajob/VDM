import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET — projets de rédaction
// Admin : tous les projets avec les rédacteurs
// Membre : ses projets uniquement
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const isAdmin = (session.user as any).role === 'ADMIN'
  const userId = (session.user as any).id

  let query = supabaseAdmin
    .from('Project')
    .select(`
      id,
      name,
      seriesName,
      season,
      episodeNumber,
      broadcastChannel,
      projectCode,
      projectType,
      deadline,
      startDate,
      pageCount,
      writingDate,
      isWritten,
      writtenAt,
      status,
      workflowStep,
      comment,
      redacteurId,
      redacteur:redacteurId (
        id,
        name,
        email,
        jobRole
      )
    `)
    .eq('workflowStep', 'REDACTION')
    .order('deadline', { ascending: true })

  // Membre : uniquement ses projets
  if (!isAdmin) {
    query = query.eq('redacteurId', userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Redaction fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Admin : grouper par rédacteur
  if (isAdmin) {
    const grouped: Record<string, { redacteur: any; projects: any[] }> = {}

    for (const project of data || []) {
      const redacteur = project.redacteur as any
      const redId = redacteur?.id || 'non-assigne'
      const redName = redacteur?.name || 'Non assigné'

      if (!grouped[redId]) {
        grouped[redId] = {
          redacteur: redacteur || { id: 'non-assigne', name: 'Non assigné', jobRole: 'REDACTEUR' },
          projects: [],
        }
      }
      grouped[redId].projects.push(project)
    }

    return NextResponse.json({ grouped: Object.values(grouped), isAdmin: true })
  }

  return NextResponse.json({ projects: data || [], isAdmin: false })
}

// PATCH — mise à jour statut + infos rédaction par le membre
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const isAdmin = (session.user as any).role === 'ADMIN'
  const body = await req.json()
  const { projectId, status, pageCount, writingDate, comment } = body

  if (!projectId) return NextResponse.json({ error: 'projectId requis' }, { status: 400 })

  // Vérifier que le membre est bien le rédacteur du projet
  if (!isAdmin) {
    const { data: proj } = await supabaseAdmin
      .from('Project')
      .select('redacteurId')
      .eq('id', projectId)
      .single()

    if (proj?.redacteurId !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
  }

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() }

  if (status !== undefined) updates.status = status
  if (pageCount !== undefined) updates.pageCount = pageCount
  if (writingDate !== undefined) updates.writingDate = writingDate
  if (comment !== undefined) updates.comment = comment

  // Marquer isWritten si statut FAIT
  if (status === 'FAIT') {
    updates.isWritten = true
    updates.writtenAt = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('Project')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
