import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET admin statistics (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const [
      totalProjects,
      completedProjects,
      inProgressProjects,
      notStartedProjects,
      totalUsers,
      totalSeries,
      totalCharacters,
      recentProjects,
    ] = await Promise.all([
      db.project.count(),
      db.project.count({ where: { status: 'DONE' } }),
      db.project.count({ where: { status: 'IN_PROGRESS' } }),
      db.project.count({ where: { status: 'NOT_STARTED' } }),
      db.user.count(),
      db.series.count(),
      db.character.count(),
      db.project.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: {
            select: {
              name: true,
            },
          },
        },
      }),
    ])

    // Calculate late projects
    const now = new Date()
    const lateProjects = await db.project.count({
      where: {
        deadline: { lt: now },
        status: { not: 'DONE' },
      },
    })

    return NextResponse.json({
      totalProjects,
      completedProjects,
      inProgressProjects,
      notStartedProjects,
      lateProjects,
      totalUsers,
      totalSeries,
      totalCharacters,
      recentProjects,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
