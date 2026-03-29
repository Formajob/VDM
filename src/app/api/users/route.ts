import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// No auth required - team member names are not sensitive
export async function GET() {
  try {
    const {  data, error } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, pr, "jobRole"')  // ✅ AJOUT: pr et "jobRole"
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}