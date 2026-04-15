// src/app/api/projects/dispatch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET — projets non encore dispatchés (workflowStep = DISPATCH) + liste rédacteurs
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const [{ data: projects, error: projectsError }, { data: redacteurs, error: usersError }] = await Promise.all([
      supabaseAdmin
        .from('Project')
        .select('id, name, seriesName, season, episodeNumber, broadcastChannel, projectCode, deadline, startDate, durationMin, pageCount, comment, redacteurId, workflowStep, status')
        .eq('workflowStep', 'DISPATCH')
        .order('deadline', { ascending: true }),
      supabaseAdmin
        .from('User')
        .select('id, name, email, jobRole')
        .eq('role', 'MEMBER')
        .eq('jobRole', 'REDACTEUR')
        .eq('isActive', true)
        .order('name'),
    ])

    if (projectsError) {
      console.error('❌ Projects fetch error:', projectsError)
      return NextResponse.json({ error: projectsError.message }, { status: 500 })
    }
    if (usersError) {
      console.error('❌ Users fetch error:', usersError)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      projects: projects || [], 
      redacteurs: redacteurs || [] 
    })
  } catch (e: any) {
    console.error('❌ GET exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — assigner plusieurs projets à un rédacteur
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const { projectIds, redacteurId } = await req.json()
    if (!projectIds?.length || !redacteurId) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('Project')
      .update({
        redacteurId,
        workflowStep: 'REDACTION',
        status: 'PAS_ENCORE',
        updatedAt: new Date().toISOString(),
      })
      .in('id', projectIds)

    if (error) {
      console.error('❌ PATCH error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, count: projectIds.length })
  } catch (e: any) {
    console.error('❌ PATCH exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — ajouter un projet unique
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const body = await req.json()
    const { name, seriesName, season, episodeNumber, broadcastChannel, projectCode, deadline, startDate, durationMin, pageCount, comment, redacteurId } = body

    if (!seriesName || !deadline) {
      return NextResponse.json({ error: 'Série et échéance obligatoires' }, { status: 400 })
    }

    // ✅ ID = nom brut du fichier (pour suivi client)
    const projectId = name || seriesName

    const insertData = {
      id: projectId,
      name: projectId,
      seriesName: seriesName || '',
      season: season || null,
      episodeNumber: episodeNumber || null,
      broadcastChannel: broadcastChannel || null,
      projectCode: projectCode || null,
      deadline,
      startDate: startDate || null,
      durationMin: durationMin || null,
      pageCount: pageCount || null,
      comment: comment || null,
      redacteurId: (redacteurId && redacteurId !== 'none') ? redacteurId : null,
      workflowStep: 'DISPATCH',  // ✅ TOUS commencent en DISPATCH
      status: 'PAS_ENCORE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('Project')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('❌ POST exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — modifier les infos d'un projet
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('Project')
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('❌ PUT exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}