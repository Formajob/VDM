
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const team = searchParams.get('team') || 'all'

    // ✅ CORRECTION: Uniquement Rédacteurs et Tech Son
    let query = supabaseAdmin
      .from('User')
      .select('id, name, jobRole')
      .eq('role', 'MEMBER')
      .in('jobRole', ['REDACTEUR', 'TECH_SON'])  // ✅ PAS NARRATEUR ni LIVREUR
      .order('name')

    if (team === 'redaction') {
      query = query.eq('jobRole', 'REDACTEUR')
    } else if (team === 'mixage') {
      query = query.eq('jobRole', 'TECH_SON')
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ users: data || [] })
  } catch (e: any) {
    console.error('❌ Users all API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}