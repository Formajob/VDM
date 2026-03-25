import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET projects (filtered by user role)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'deadline'

    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    let query = supabaseAdmin
      .from('Project')
      .select(`
        *,
        redacteur:User!Project_redacteurId_fkey (id, name, email),
        techSon:User!Project_techSonId_fkey (id, name, email),
        narrator:User!Project_narratorId_fkey (id, name, email)
      `)

    // Members only see projects where they are assigned in any role
    if (userRole !== 'ADMIN') {
      query = query.or(`redacteurId.eq.${userId},techSonId.eq.${userId},narratorId.eq.${userId}`)
    }

    // Filter by status
    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    // Sort
    if (sortBy === 'deadline') {
      query = query.order('deadline', { ascending: true })
    } else if (sortBy === 'name') {
      query = query.order('name', { ascending: true })
    } else {
      query = query.order('createdAt', { ascending: false })
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST new project (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name, seriesName, season, episodeNumber, materialRef,
      workflowStep, status, pageCount, writingDate, durationMin,
      mixingDate, narratorName, isAINarrator, deadline, comment,
      redacteurId, techSonId, narratorId, projectCode, startDate,
      broadcastChannel, projectType, clientName, language, totalEpisodes, notes
    } = body

    if (!name || !deadline) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('Project')
      .insert({
        name, seriesName, season, episodeNumber, materialRef,
        workflowStep: workflowStep || 'REDACTION',
        status: status || 'PAS_ENCORE',
        pageCount, writingDate, durationMin, mixingDate,
        narratorName, isAINarrator,
        deadline: new Date(deadline).toISOString(),
        comment, redacteurId, techSonId, narratorId,
        projectCode, startDate, broadcastChannel, projectType,
        clientName, language, totalEpisodes, notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select(`
        *,
        redacteur:User!Project_redacteurId_fkey (id, name, email),
        techSon:User!Project_techSonId_fkey (id, name, email),
        narrator:User!Project_narratorId_fkey (id, name, email)
      `)
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
