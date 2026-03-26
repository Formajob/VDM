import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nanoid } from 'nanoid'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Close any open record for a user
async function closeActiveRecord(userId: string, endTime: Date) {
  const { data: active } = await supabaseAdmin
    .from('Attendance')
    .select('*')
    .eq('userId', userId)
    .is('endedAt', null)
    .maybeSingle()

  if (active) {
    const started = new Date(active.startedAt + 'Z')
    const durationMin = parseFloat(((endTime.getTime() - started.getTime()) / 60000).toFixed(2))
    await supabaseAdmin
      .from('Attendance')
      .update({
        endedAt: endTime.toISOString(),
        durationMin: durationMin > 0 ? durationMin : 0,
        updatedAt: endTime.toISOString(),
      })
      .eq('id', active.id)
  }

  return active
}

// Delete all records for a user on a specific date and insert a full-day entry
async function setFullDayStatus(userId: string, status: 'ABSENT' | 'CONGE', date: string) {
  // Delete existing records for that day
  await supabaseAdmin
    .from('Attendance')
    .delete()
    .eq('userId', userId)
    .gte('startedAt', `${date}T00:00:00`)
    .lte('startedAt', `${date}T23:59:59`)

  // Insert 8h00 → 17h00 (540 min)
  const startedAt = `${date}T08:00:00`
  const endedAt = `${date}T17:00:00`
  const durationMin = 540

  const { data, error } = await supabaseAdmin
    .from('Attendance')
    .insert({
      id: nanoid(),
      userId,
      status,
      startedAt,
      endedAt,
      durationMin,
      note: status === 'CONGE' ? 'Congé journée complète' : 'Absence journée complète',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select(`*, user:User!Attendance_userId_fkey (id, name, email, jobRole)`)
    .single()

  if (error) throw error
  return data
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const all = searchParams.get('all')

    const userRole = (session.user as any).role
    const sessionUserId = (session.user as any).id

    let query = supabaseAdmin
      .from('Attendance')
      .select(`*, user:User!Attendance_userId_fkey (id, name, email, jobRole)`)
      .order('startedAt', { ascending: true })

    // Scope: admin with ?all=true sees everyone, otherwise scoped to user
    if (userRole !== 'ADMIN' || !all) {
      query = query.eq('userId', userId || sessionUserId)
    } else if (userId) {
      query = query.eq('userId', userId)
    }

    // Date filters
    if (date) {
      query = query.gte('startedAt', `${date}T00:00:00`).lte('startedAt', `${date}T23:59:59`)
    } else if (dateFrom && dateTo) {
      query = query.gte('startedAt', `${dateFrom}T00:00:00`).lte('startedAt', `${dateTo}T23:59:59`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionUserId = (session.user as any).id
    const userRole = (session.user as any).role
    const body = await request.json()
    const { status, note, targetUserId, startedAt, endedAt, forceStatus, fullDay } = body

    const isAdmin = userRole === 'ADMIN'
    const affectedUserId = isAdmin && targetUserId ? targetUserId : sessionUserId

    const now = new Date()

    // ── Case 1: Full day (CONGE or ABSENT) ──────────────────────────────────
    if ((status === 'CONGE' || status === 'ABSENT') && fullDay) {
      const date = startedAt
        ? startedAt.split('T')[0]
        : now.toISOString().split('T')[0]
      const data = await setFullDayStatus(affectedUserId, status, date)
      return NextResponse.json(data, { status: 201 })
    }

    // ── Case 2: Admin manual insert with explicit times (gestion tab) ────────
    if (isAdmin && targetUserId && startedAt && !forceStatus) {
      const start = new Date(startedAt)
      const end = endedAt ? new Date(endedAt) : null
      const durationMin = end
        ? parseFloat(((end.getTime() - start.getTime()) / 60000).toFixed(2))
        : null

      const { data, error } = await supabaseAdmin
        .from('Attendance')
        .insert({
          id: nanoid(),
          userId: affectedUserId,
          status,
          startedAt: start.toISOString(),
          endedAt: end ? end.toISOString() : null,
          durationMin,
          note: note || null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .select(`*, user:User!Attendance_userId_fkey (id, name, email, jobRole)`)
        .single()

      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    // ── Case 3: Force status change (admin realtime) ─────────────────────────
    // Also: normal member status change
    // Both need to close the active record first
    await closeActiveRecord(affectedUserId, now)

    // DEPART — just close, no new record
    if (status === 'DEPART') {
      return NextResponse.json({ departed: true })
    }

    // Insert new active record
    const { data, error } = await supabaseAdmin
      .from('Attendance')
      .insert({
        id: nanoid(),
        userId: affectedUserId,
        status,
        startedAt: now.toISOString(),
        note: note || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .select(`*, user:User!Attendance_userId_fkey (id, name, email, jobRole)`)
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating attendance:', error)
    return NextResponse.json({ error: 'Failed to create attendance' }, { status: 500 })
  }
}
