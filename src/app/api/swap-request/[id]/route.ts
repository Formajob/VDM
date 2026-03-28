import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Next.js 15+: params is a Promise
    const { id } = await params
    
    console.log('🔹 PATCH /api/swap-request/[id]', id)
    
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    console.log('User:', { userId, userRole })
    console.log('Body:', body)

    // ⚠️ CORRECT: { data: variableName, error }
    const { data: swap, error: fetchError } = await supabaseAdmin
      .from('SwapRequest')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError)
      return NextResponse.json({ error: 'Database error', details: fetchError }, { status: 500 })
    }
    
    if (!swap) {
      console.error('❌ Swap not found:', id)
      return NextResponse.json({ error: 'Swap request not found' }, { status: 404 })
    }

    console.log('✅ Found swap:', { id: swap.id, status: swap.status })

    let updateData: any = { updatedat: new Date().toISOString() }

    // Target user responds
    if (body.targetResponse && userId === swap.targetuserid) {
      console.log('🔹 Target responding:', { response: body.targetResponse })
      updateData.targetresponse = body.targetResponse
      updateData.status = body.targetResponse === 'ACCEPTED' ? 'TARGET_ACCEPTED' : 'REJECTED'
    }

    // Admin validates
    if (body.adminStatus && userRole === 'ADMIN') {
      console.log('🔹 Admin validating:', { status: body.adminStatus })
      updateData.status = body.adminStatus
      updateData.adminnote = body.adminNote || null

      // If approved, swap the plannings
      if (body.adminStatus === 'ADMIN_APPROVED') {
        console.log('🔄 Swapping plannings...')
        
        // ⚠️ CORRECT: { data: variableName }
        const { data: reqPlanning } = await supabaseAdmin
          .from('Planning')
          .select('*')
          .eq('userid', swap.requesterid)
          .eq('weekstart', swap.weekstart)
          .single()

        const { data: tgtPlanning } = await supabaseAdmin
          .from('Planning')
          .select('*')
          .eq('userid', swap.targetuserid)
          .eq('weekstart', swap.weekstart)
          .single()

        if (reqPlanning && tgtPlanning) {
          await supabaseAdmin
            .from('Planning')
            .update({
              monday: tgtPlanning.monday,
              tuesday: tgtPlanning.tuesday,
              wednesday: tgtPlanning.wednesday,
              thursday: tgtPlanning.thursday,
              friday: tgtPlanning.friday,
              saturday: tgtPlanning.saturday,
              sunday: tgtPlanning.sunday,
              updatedat: new Date().toISOString(),
            })
            .eq('id', reqPlanning.id)

          await supabaseAdmin
            .from('Planning')
            .update({
              monday: reqPlanning.monday,
              tuesday: reqPlanning.tuesday,
              wednesday: reqPlanning.wednesday,
              thursday: reqPlanning.thursday,
              friday: reqPlanning.friday,
              saturday: reqPlanning.saturday,
              sunday: reqPlanning.sunday,
              updatedat: new Date().toISOString(),
            })
            .eq('id', tgtPlanning.id)
          
          console.log('✅ Plannings swapped')
        }
      }
    }

    // ⚠️ CORRECT: { data: variableName, error }
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('SwapRequest')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Update error:', updateError)
      return NextResponse.json({ error: 'Update failed', details: updateError }, { status: 500 })
    }
    
    console.log('✅ Swap updated:', updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // ⚠️ CORRECT: { data, error }
    const { data, error } = await supabaseAdmin
      .from('SwapRequest')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    
    if (data) {
      // ⚠️ CORRECT: { data: variableName }
      const { data: users } = await supabaseAdmin
        .from('User')
        .select('id, name, email')
        .in('id', [data.requesterid, data.targetuserid])
      
      const userMap = new Map(users?.map((u: any) => [u.id, u]) || [])
      return NextResponse.json({
        ...data,
        requester: userMap.get(data.requesterid),
        target: userMap.get(data.targetuserid)
      })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching swap:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

