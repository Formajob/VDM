import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('Project')
      .select('*')

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Error fetching projects' }, { status: 500 })
  }
}