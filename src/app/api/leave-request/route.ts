import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const now = new Date()

    const {  data, error } = await supabaseAdmin
      .from('LeaveRequest')
      .insert({
        id: nanoid(),
        userid: body.userId,
        startdate: body.startDate,
        enddate: body.endDate,
        type: body.type,
        reason: body.reason,
        status: 'PENDING',
        adminnote: body.adminNote,
        createdat: now.toISOString(),
        updatedat: now.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating leave request:', error)
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const {  data, error } = await supabaseAdmin
      .from('LeaveRequest')
      .select('*')
      .eq('userid', userId)
      .order('createdat', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}