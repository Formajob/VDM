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
      .from('SwapRequest')
      .insert({
        id: nanoid(),
        requesterid: body.requesterId,
        targetuserid: body.targetUserId,
        weekstart: body.weekStart,
        weekend: body.weekEnd,
        status: 'PENDING',
        targetresponse: body.targetResponse,
        adminnote: body.adminNote,
        createdat: now.toISOString(),
        updatedat: now.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating swap request:', error)
    return NextResponse.json({ error: 'Failed to create swap request' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')

    let query = supabaseAdmin
      .from('SwapRequest')
      .select('*')
      .order('createdat', { ascending: false })

    if (type === 'requester') {
      query = query.eq('requesterid', userId)
    } else if (type === 'target') {
      query = query.eq('targetuserid', userId)
    }

    const {  data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching swap requests:', error)
    return NextResponse.json({ error: 'Failed to fetch swap requests' }, { status: 500 })
  }
}