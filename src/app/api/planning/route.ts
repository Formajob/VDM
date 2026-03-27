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
    const weekStart = searchParams.get('weekStart')
    const all = searchParams.get('all')

    let query = supabaseAdmin.from('Planning').select('*')

    if (userId && !all) {
      query = query.eq('userid', userId)
    }
    if (weekStart) {
      query = query.eq('weekstart', weekStart)
    }

    const {  data, error } = await query
    if (error) {
      console.error('❌ Planning query error:', error)
      throw error
    }

    console.log('✅ Planning data:', data?.length, 'records')

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p: any) => p.userid))]
      console.log('🔍 Fetching users:', userIds)
      
      const {  data: usersData, error: userError } = await supabaseAdmin
        .from('User')
        .select('id, name, email')
        .in('id', userIds)
      
      if (userError) {
        console.error('❌ User query error:', userError)
      }
      
      console.log('✅ Users fetched:', usersData?.length)
      
      const userMap = new Map<any, any>()
      usersData?.forEach((u: any) => {
        userMap.set(u.id, u)
      })
      console.log('🗺️ UserMap keys:', Array.from(userMap.keys()))
      
      const enriched = data.map((p: any) => {
        const user = userMap.get(p.userid)
        console.log('📌 Planning for', p.userid, ':', user ? user.name : 'NOT FOUND')
        return {
          ...p,
          user: user || { name: 'Membre', email: '' }
        }
      })
      
      if (userId && !all) return NextResponse.json(enriched[0] || null)
      return NextResponse.json(enriched)
    }

    if (userId && !all) return NextResponse.json(null)
    return NextResponse.json([])
  } catch (error) {
    console.error('❌ Error fetching planning:', error)
    return NextResponse.json({ error: 'Failed to fetch planning' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const now = new Date()

    const {  data, error } = await supabaseAdmin
      .from('Planning')
      .insert({
        id: nanoid(),
        userid: body.userId,
        weekstart: body.weekStart,
        weekend: body.weekEnd,
        monday: body.monday,
        tuesday: body.tuesday,
        wednesday: body.wednesday,
        thursday: body.thursday,
        friday: body.friday,
        saturday: body.saturday,
        sunday: body.sunday,
        createdat: now.toISOString(),
        updatedat: now.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating planning:', error)
    return NextResponse.json({ error: 'Failed to create planning' }, { status: 500 })
  }
}