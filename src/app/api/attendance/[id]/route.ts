import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH - update an attendance record (admin only)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 })
    }

    const body = await req.json()
    const { status, startedAt, endedAt, note } = body

    const updateData: any = { updatedAt: new Date().toISOString() }
    if (status !== undefined) updateData.status = status
    if (note !== undefined) updateData.note = note
    if (startedAt !== undefined) updateData.startedAt = new Date(startedAt).toISOString()
    if (endedAt !== undefined) {
      updateData.endedAt = endedAt ? new Date(endedAt).toISOString() : null
    }

    // Recalculate duration if both times are set
    if (updateData.startedAt && updateData.endedAt) {
      const diff = (new Date(updateData.endedAt).getTime() - new Date(updateData.startedAt).getTime()) / 60000
      updateData.durationMin = parseFloat(diff.toFixed(2))
    } else if (updateData.endedAt === null) {
      updateData.durationMin = null
    }

    const { data, error } = await supabaseAdmin
      .from('Attendance')
      .update(updateData)
      .eq('id', params.id)
      .select(`*, user:User!Attendance_userId_fkey (id, name, email, jobRole)`)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating attendance:', error)
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
  }
}

// DELETE - remove an attendance record (admin only)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('Attendance')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attendance:', error)
    return NextResponse.json({ error: 'Failed to delete attendance' }, { status: 500 })
  }
}
