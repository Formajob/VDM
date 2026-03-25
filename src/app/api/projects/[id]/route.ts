import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const SELECT = `
  *,
  redacteur:User!Project_redacteurId_fkey (id, name, email),
  techSon:User!Project_techSonId_fkey (id, name, email),
  narrator:User!Project_narratorId_fkey (id, name, email)
`

// GET single project
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('Project')
      .select(SELECT)
      .eq('id', params.id)
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Error fetching project' }, { status: 500 })
  }
}

// PATCH update project
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    const { data, error } = await supabaseAdmin
      .from('Project')
      .update({ ...body, updatedAt: new Date().toISOString() })
      .eq('id', params.id)
      .select(SELECT)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Error updating project' }, { status: 500 })
  }
}

// DELETE project (admin only)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('Project')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Error deleting project' }, { status: 500 })
  }
}
