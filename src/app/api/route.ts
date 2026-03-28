import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const {  data, error } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role')
      .order('name', { ascending: true })

    if (error) throw error
    
    // Filter out sensitive data
    const users = data?.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role
    })) || []
    
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}