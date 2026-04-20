import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as bcrypt from 'bcryptjs'

// GET single user
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = (session.user as any).role === 'ADMIN'
    const isOwnProfile = session.user.id === params.id

    // Seul l'admin ou l'utilisateur lui-même peut accéder
    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only access your own profile.' },
        { status: 403 }
      )
    }

    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('id, email, name, role, jobRole, isActive, createdat, updatedat')
      .eq('id', params.id)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Si admin, ajouter le nombre de projets
    if (isAdmin) {
      const { count } = await supabaseAdmin
        .from('Project')
        .select('*', { count: 'exact', head: true })
        .eq('assignedToId', params.id)

      return NextResponse.json({ ...user, _count: { projects: count ?? 0 } })
    }

    // Sinon, retourner juste les infos de base
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PUT update user (pour les utilisateurs qui modifient leur propre profil)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = (session.user as any).role === 'ADMIN'
    const isOwnProfile = session.user.id === params.id

    // Seul l'admin ou l'utilisateur lui-même peut modifier
    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only modify your own profile.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    const { data: existingUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('email', email)
      .neq('id', params.id)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 })
    }

    // Les utilisateurs normaux ne peuvent modifier que leur nom et email
    const updateData: any = {
      name: name.trim(),
      email: email.trim(),
      updatedat: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('User')
      .update(updateData)
      .eq('id', params.id)
      .select('id, email, name, role, jobRole, isActive, createdat, updatedat')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// PATCH update user (admin only - pour modifications avancées)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, role, jobRole, isActive, password } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (jobRole !== undefined) updateData.jobRole = jobRole
    if (isActive !== undefined) updateData.isActive = isActive
    if (password !== undefined) {
      updateData.password = await bcrypt.hash(password, 10)
    }
    updateData.updatedat = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('User')
      .update(updateData)
      .eq('id', params.id)
      .select('id, email, name, role, jobRole, isActive, createdat, updatedat')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE user (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const { error } = await supabaseAdmin
      .from('User')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}