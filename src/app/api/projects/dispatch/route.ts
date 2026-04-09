// src/app/api/projects/dispatch/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET — projets non encore dispatchés (workflowStep = DISPATCH) + liste rédacteurs
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

  const [{ data: projects }, { data: redacteurs }] = await Promise.all([
    supabaseAdmin
      .from('Project')
      .select('id, name, seriesName, season, episodeNumber, broadcastChannel, projectCode, deadline, startDate, durationMin, pageCount, comment')
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

  return NextResponse.json({ projects: projects || [], redacteurs: redacteurs || [] })
}

// PATCH — assigner plusieurs projets à un rédacteur
export async function PATCH(req: NextRequest) {
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, count: projectIds.length })
}

// POST — créer un nouveau projet à dispatcher
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

  const body = await req.json()
  const { name, seriesName, season, episodeNumber, broadcastChannel, projectCode, deadline, startDate, durationMin, pageCount, comment } = body

  if (!seriesName || !deadline) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('Project')
    .insert({
      name: name || seriesName,
      seriesName,
      season,
      episodeNumber,
      broadcastChannel,
      projectCode,
      deadline,
      startDate,
      durationMin,
      pageCount,
      comment,
      workflowStep: 'DISPATCH',
      status: 'PAS_ENCORE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT — modifier les infos d'un projet
export async function PUT(req: NextRequest) {
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
}