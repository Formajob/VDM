// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const jobRole = searchParams.get('jobRole')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const role = searchParams.get('role')

    // ✅ CORRECTION: Construire la requête correctement
    let query = supabaseAdmin
      .from('User')
      .select('id, name, email, jobRole, role, isActive')

    // ✅ Filtrer par jobRole si spécifié (ex: TECH_SON, REDACTEUR)
    if (jobRole) {
      query = query.eq('jobRole', jobRole)
    }

    // ✅ Filtrer par role si spécifié (ex: MEMBER, ADMIN)
    if (role) {
      query = query.eq('role', role)
    }

    // ✅ Inclure ou exclure les utilisateurs inactifs
    if (!includeInactive) {
      query = query.eq('isActive', true)
    }

    // ✅ Exécuter la requête
    const {  data:users, error } = await query

    if (error) {
      console.error('❌ Users fetch error:', error)
      return NextResponse.json({ error: error.message, users: [] }, { status: 500 })
    }

    // ✅ CORRECTION: Retourner TOUJOURS un array, pas un objet
    // Les pages attendent un array directement, pas { users: [...] }
    const usersList = users || []
    
    console.log('📦 [USERS API] Users found:', usersList.length, 'JobRole:', jobRole, 'Role:', role)

    // ✅ Retourner l'array directement (pas { users: [...] })
    return NextResponse.json(usersList)
  } catch (e: any) {
    console.error('❌ Users API error:', e)
    return NextResponse.json({ error: e.message, users: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { userId, action, isActive } = body

    if (action === 'toggleActive') {
      const { error } = await supabaseAdmin
        .from('User')
        .update({ isActive: isActive !== false })
        .eq('id', userId)
      
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ Users update error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}