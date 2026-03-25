import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as bcrypt from 'bcryptjs'

// GET all users (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const { data: users, error } = await supabaseAdmin
      .from('User')
      .select('id, email, name, role, jobRole, isActive, createdAt')
      .order('createdAt', { ascending: false })

    if (error) throw error

    // Attach project count per user
    const usersWithCount = await Promise.all(
      (users || []).map(async (user) => {
        const { count } = await supabaseAdmin
          .from('Project')
          .select('*', { count: 'exact', head: true })
          .eq('assignedToId', user.id)

        return { ...user, _count: { projects: count ?? 0 } }
      })
    )

    return NextResponse.json(usersWithCount)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST new user (admin only)
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
    const { email, name, password, role, jobRole } = body

    if (!email || !name || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data, error } = await supabaseAdmin
      .from('User')
      .insert({
        email,
        name,
        password: hashedPassword,
        role,
        jobRole: jobRole || null,
        isActive: true,
      })
      .select('id, email, name, role, jobRole, isActive, createdAt')
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
