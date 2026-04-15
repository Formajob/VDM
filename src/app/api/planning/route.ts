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

    const { data, error } = await query
    if (error) {
      console.error('❌ Planning query error:', error)
      throw error
    }

    console.log('✅ Planning data:', data?.length, 'records')

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p: any) => p.userid))]
      console.log('🔍 Fetching users:', userIds)
      
      const { data: usersData, error: userError } = await supabaseAdmin
        .from('User')
        .select('id, name, email, jobRole')
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
          user: user || { name: 'Membre', email: '', jobRole: '' }
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

    const { data, error } = await supabaseAdmin
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

// ✅ NOUVELLE ROUTE PUT POUR METTRE À JOUR LE PLANNING
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const now = new Date()

    console.log('📝 Updating planning:', body)

    // Chercher le planning existant pour cette semaine et cet utilisateur
    const { data: existingPlanning, error: findError } = await supabaseAdmin
      .from('Planning')
      .select('*')
      .eq('userid', body.userid)
      .eq('weekstart', body.weekstart)
      .single()

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ Error finding existing planning:', findError)
      throw findError
    }

    // Si le planning existe, on le met à jour
    if (existingPlanning) {
      console.log('🔄 Updating existing planning:', existingPlanning.id)
      
      // Construire l'objet de mise à jour avec seulement les champs modifiés
      const updateData: any = {
        updatedat: now.toISOString(),
      }

      // Copier tous les jours depuis l'existing planning
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      days.forEach(day => {
        updateData[day] = existingPlanning[day]
      })

      // Appliquer les modifications du body
      days.forEach(day => {
        if (body[day] !== undefined) {
          updateData[day] = body[day]
        }
      })

      const { data, error } = await supabaseAdmin
        .from('Planning')
        .update(updateData)
        .eq('id', existingPlanning.id)
        .select()
        .single()

      if (error) {
        console.error('❌ Update error:', error)
        throw error
      }

      console.log('✅ Planning updated successfully')
      return NextResponse.json(data, { status: 200 })
    } 
    // Sinon, on crée un nouveau planning
    else {
      console.log('➕ Creating new planning for user:', body.userid)
      
      const { data, error } = await supabaseAdmin
        .from('Planning')
        .insert({
          id: nanoid(),
          userid: body.userid,
          weekstart: body.weekstart,
          weekend: body.weekend,
          monday: body.monday || null,
          tuesday: body.tuesday || null,
          wednesday: body.wednesday || null,
          thursday: body.thursday || null,
          friday: body.friday || null,
          saturday: body.saturday || null,
          sunday: body.sunday || null,
          createdat: now.toISOString(),
          updatedat: now.toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Insert error:', error)
        throw error
      }

      console.log('✅ New planning created successfully')
      return NextResponse.json(data, { status: 201 })
    }
  } catch (error) {
    console.error('❌ Error in PUT /api/planning:', error)
    return NextResponse.json({ error: 'Failed to update planning' }, { status: 500 })
  }
}
