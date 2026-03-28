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
        targetresponse: null,
        adminnote: null,
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

    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'incoming', 'outgoing', 'admin'

    let query = supabaseAdmin
      .from('SwapRequest')
      .select(`
        *,
        requester:User!SwapRequest_requesterid_fkey (id, name, email),
        target:User!SwapRequest_targetuserid_fkey (id, name, email)
      `)
      .order('createdat', { ascending: false })

    if (type === 'incoming' && userRole !== 'ADMIN') {
      // Requests where I am the target
      query = query.eq('targetuserid', userId)
    } else if (type === 'outgoing' && userRole !== 'ADMIN') {
      // Requests where I am the requester
      query = query.eq('requesterid', userId)
    } else if (type === 'admin' || userRole === 'ADMIN') {
      // Admin sees all pending approvals
      query = query.in('status', ['TARGET_ACCEPTED', 'PENDING'])
    }

    const {  data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching swap requests:', error)
    return NextResponse.json({ error: 'Failed to fetch swap requests' }, { status: 500 })
  }
}