// src/app/api/projects/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────
// GET: Récupérer la liste des projets
// ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const workflowStep = searchParams.get('workflowStep')
    const sortBy = searchParams.get('sortBy') || 'deadline'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search')?.toLowerCase().trim() || ''
    const includeAll = searchParams.get('includeAll') === 'true'

    const userRole = (session.user as any).role
    const userId = (session.user as any).id
    const isAdmin = userRole === 'ADMIN'

    let query = supabaseAdmin
      .from('Project')
      .select(`
        *,
        User:redacteurId (id, name),
        User_1:techSonId (id, name)
      `)

    if (!isAdmin || !includeAll) {
      query = query.or(`redacteurId.eq.${userId},techSonId.eq.${userId}`)
    }

    if (status && status !== 'ALL' && status !== 'all') {
      query = query.eq('status', status)
    }

    if (workflowStep && workflowStep !== 'ALL' && workflowStep !== 'all') {
      query = query.eq('workflowStep', workflowStep)
    }

    const ascending = sortOrder === 'asc'
    switch (sortBy) {
      case 'deadline':
        query = query.order('deadline', { ascending })
        break
      case 'name':
        query = query.order('name', { ascending })
        break
      case 'createdAt':
        query = query.order('createdAt', { ascending: !ascending })
        break
      case 'durationMin':
        query = query.order('durationMin', { ascending: !ascending })
        break
      case 'workflowStep':
        query = query.order('workflowStep', { ascending })
        break
      default:
        query = query.order('deadline', { ascending: true })
    }

    // ✅ CORRECTION: Utiliser { data, error } puis renommer
    const { data, error } = await query
    if (error) {
      console.error('❌ [PROJECTS API] GET error:', error)
      throw error
    }

    let filteredProjects = data || []
    if (search) {
      filteredProjects = filteredProjects.filter((p: any) =>
        p.name?.toLowerCase().includes(search) ||
        p.seriesName?.toLowerCase().includes(search) ||
        p.projectCode?.toLowerCase().includes(search) ||
        p.comment?.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({ projects: filteredProjects })
  } catch (error: any) {
    console.error('❌ [PROJECTS API] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch projects' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST: Créer ou mettre à jour un projet
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin required.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      id, name, seriesName, season, episodeNumber, broadcastChannel,
      projectCode, projectType, deadline, startDate, durationMin,
      pageCount, status, mixStatus, workflowStep, comment,
      redacteurId, techSonId
    } = body

    if (!name || !deadline) {
      return NextResponse.json({ error: 'Missing required fields: name, deadline' }, { status: 400 })
    }

    const projectData: any = {
      name,
      seriesName,
      season: season || null,
      episodeNumber: episodeNumber || null,
      broadcastChannel: broadcastChannel || null,
      projectCode: projectCode || null,
      projectType: projectType || 'SERIE_EMISSION',
      deadline: new Date(deadline).toISOString(),
      startDate: startDate ? new Date(startDate).toISOString() : null,
      durationMin: durationMin !== undefined ? durationMin : null,
      pageCount: pageCount !== undefined ? pageCount : null,
      status: status || 'PAS_ENCORE',
      mixStatus: mixStatus || 'PAS_ENCORE',
      workflowStep: workflowStep || 'DISPATCH',
      comment: comment || null,
      redacteurId: redacteurId || null,
      techSonId: techSonId || null,
      updatedAt: new Date().toISOString(),
    }

    let result
    if (id) {
      // ✅ Mise à jour - CORRECTION: { data, error }
      const { data, error } = await supabaseAdmin
        .from('Project')
        .update(projectData)
        .eq('id', id)
        .select(`
          *,
          User:redacteurId (id, name),
          User_1:techSonId (id, name)
        `)
        .single()

      if (error) {
        console.error('❌ [PROJECTS API] PUT error:', error)
        throw error
      }
      result = data
      console.log('✅ Project updated:', id)
    } else {
      // ✅ Création - Vérifier doublons
      // ✅ CORRECTION: { data, error }
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('Project')
        .select('id')
        .eq('name', name)
        .maybeSingle()

      if (checkError) throw checkError
      if (existing) {
        return NextResponse.json(
          { error: `Un projet avec ce nom existe déjà (ID: ${existing.id})` },
          { status: 409 }
        )
      }

      projectData.createdAt = new Date().toISOString()

      // ✅ CORRECTION: { data, error }
      const { data, error } = await supabaseAdmin
        .from('Project')
        .insert(projectData)
        .select(`
          *,
          User:redacteurId (id, name),
          User_1:techSonId (id, name)
        `)
        .single()

      if (error) {
        console.error('❌ [PROJECTS API] POST error:', error)
        throw error
      }
      result = data
      console.log('✅ Project created:', result?.id)
    }

    return NextResponse.json(result, { status: id ? 200 : 201 })
  } catch (error: any) {
    console.error('❌ [PROJECTS API] POST/PUT Error:', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// PUT: Mettre à jour un projet
// ─────────────────────────────────────────────────────────────
export async function PUT(request: Request) {
  return POST(request)
}

// ─────────────────────────────────────────────────────────────
// DELETE: Supprimer un projet
// ─────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin required.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('Project')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ [PROJECTS API] DELETE error:', error)
      throw error
    }

    console.log('✅ Project deleted:', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [PROJECTS API] DELETE Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 })
  }
}