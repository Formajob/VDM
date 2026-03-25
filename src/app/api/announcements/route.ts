import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all announcements
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('Announcement')
      .select(`
        *,
        createdBy:User!Announcement_createdById_fkey (
          name
        )
      `)
      .order('createdAt', { ascending: false })
      .limit(10)

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}

// POST new announcement (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, content } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('Announcement')
      .insert({
        title,
        content,
        createdById: (session.user as any).id,
      })
      .select(`
        *,
        createdBy:User!Announcement_createdById_fkey (
          name
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
  }
}
