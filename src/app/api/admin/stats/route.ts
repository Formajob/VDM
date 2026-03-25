import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 })
    }

    const now = new Date().toISOString()

    const [
      { count: totalProjects },
      { count: completedProjects },
      { count: inProgressProjects },
      { count: notStartedProjects },
      { count: totalUsers },
      { count: totalSeries },
      { count: totalCharacters },
      { count: lateProjects },
      { data: recentProjects },
    ] = await Promise.all([
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).eq('status', 'DONE'),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).eq('status', 'NOT_STARTED'),
      supabaseAdmin.from('User').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('Series').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('Character').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('Project').select('*', { count: 'exact', head: true }).lt('deadline', now).neq('status', 'DONE'),
      supabaseAdmin
        .from('Project')
        .select(`*, assignedTo:User!Project_assignedToId_fkey (name)`)
        .order('createdAt', { ascending: false })
        .limit(5),
    ])

    return NextResponse.json({
      totalProjects: totalProjects ?? 0,
      completedProjects: completedProjects ?? 0,
      inProgressProjects: inProgressProjects ?? 0,
      notStartedProjects: notStartedProjects ?? 0,
      lateProjects: lateProjects ?? 0,
      totalUsers: totalUsers ?? 0,
      totalSeries: totalSeries ?? 0,
      totalCharacters: totalCharacters ?? 0,
      recentProjects: recentProjects ?? [],
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}