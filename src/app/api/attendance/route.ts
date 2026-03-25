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
    const date = searchParams.get('date') // YYYY-MM-DD
    const all = searchParams.get('all') // admin: fetch all users

    const userRole = (session.user as any).role
    const sessionUserId = (session.user as any).id

    let query = supabaseAdmin
      .from('Attendance')
      .select(`
        *,
        user:User!Attendance_userId_fkey (
          id,
          name,
          email,
          jobRole
        )
      `)
      .order('startedAt', { ascending: false })

    // Admin can see all, member sees only their own
    if (userRole !== 'ADMIN' || !all) {
      query = query.eq('userId', userId || sessionUserId)
    }

    if (date) {
      const start = `${date}T00:00:00`
      const end = `${date}T23:59:59`
      query = query.gte('startedAt', start).lte('startedAt', end)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

// POST - start a new status
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionUserId = (session.user as any).id
    const body = await request.json()
    const { status, note } = body

    // Close any currently active record (no endedAt)
    const { data: active } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', sessionUserId)
      .is('endedAt', null)
      .single()

    if (active) {
      const now = new Date()
      const started = new Date(active.startedAt)
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

    // If status is DEPART, don't create a new record
    if (status === 'DEPART') {
      return NextResponse.json({ departed: true })
    }

    // Create new record
    const now = new Date()
    const { data, error } = await supabaseAdmin
      .from('Attendance')
      .insert({
        id: nanoid(),
        userId: sessionUserId,
        status,
        startedAt: now.toISOString(),
        note: note || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .select(`
        *,
        user:User!Attendance_userId_fkey (
          id,
          name,
          email,
          jobRole
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating attendance:', error)
    return NextResponse.json({ error: 'Failed to create attendance' }, { status: 500 })
  }
}
