import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nanoid } from 'nanoid'

// GET attendance records
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
      .select(`
        *,
        user:User!Attendance_userId_fkey (
          id, name, email, jobRole
        )
      `)
      .order('startedAt', { ascending: true })

    if (userRole !== 'ADMIN' || !all) {
      query = query.eq('userId', userId || sessionUserId)
    } else if (userId) {
      query = query.eq('userId', userId)
    }

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

// POST - start a new status (member) or add manual entry (admin)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionUserId = (session.user as any).id
    const userRole = (session.user as any).role
    const body = await request.json()
    const { status, note, targetUserId, startedAt, endedAt } = body

    // Admin can post for another user with manual times
    const isAdminManual = userRole === 'ADMIN' && targetUserId && startedAt
    const affectedUserId = isAdminManual ? targetUserId : sessionUserId

    if (isAdminManual) {
      // Manual insert — no auto-close logic, just insert directly
      const start = new Date(startedAt)
      const end = endedAt ? new Date(endedAt) : null
      const durationMin = end ? parseFloat(((end.getTime() - start.getTime()) / 60000).toFixed(2)) : null

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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select(`*, user:User!Attendance_userId_fkey (id, name, email, jobRole)`)
        .single()

      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    // Normal member flow — close active record first
    const { data: active } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', affectedUserId)
      .is('endedAt', null)
      .maybeSingle()

    if (active) {
      const now = new Date()
      const started = new Date(active.startedAt + 'Z')
      const durationMin = (now.getTime() - started.getTime()) / 60000
      await supabaseAdmin
        .from('Attendance')
        .update({
          endedAt: now.toISOString(),
          durationMin: parseFloat(durationMin.toFixed(2)),
          updatedAt: now.toISOString(),
        })
        .eq('id', active.id)
    }

    if (status === 'DEPART') {
      return NextResponse.json({ departed: true })
    }

    const now = new Date()
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
