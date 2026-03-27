import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nanoid } from 'nanoid'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const {  data, error } = await supabaseAdmin
      .from('LeaveBalance')
      .select('*')
      .eq('userid', userId)
      .eq('year', new Date().getFullYear())
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data && userId) {
      const now = new Date()
      const {  data: newBalance } = await supabaseAdmin
        .from('LeaveBalance')
        .insert({
          id: nanoid(),
          userid: userId,
          annualdays: 25,
          exceptionaldays: 5,
          sickdays: 10,
          year: now.getFullYear(),
          createdat: now.toISOString(),
          updatedat: now.toISOString(),
        })
        .select()
        .single()
      return NextResponse.json(newBalance)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching leave balance:', error)
    return NextResponse.json({ error: 'Failed to fetch leave balance' }, { status: 500 })
  }
}