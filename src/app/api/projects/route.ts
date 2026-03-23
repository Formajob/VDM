import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ProjectStatus } from '@prisma/client'

// GET projects (filtered by user role)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'deadline'

    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    let whereClause: any = {}

    // Members can only see their own projects
    if (userRole !== 'ADMIN') {
      whereClause.assignedToId = userId
    }

    // Filter by status
    if (status && status !== 'ALL') {
      whereClause.status = status
    }

    const projects = await db.project.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy:
        sortBy === 'deadline'
          ? { deadline: 'asc' }
          : sortBy === 'name'
          ? { name: 'asc' }
          : { createdAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST new project (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      name,
      seriesName,
      season,
      pageCount,
      writingDate,
      deadline,
      status,
      progress,
      assignedToId,
    } = body

    if (!name || !seriesName || !season || !pageCount || !deadline || !assignedToId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const project = await db.project.create({
      data: {
        name,
        seriesName,
        season,
        pageCount,
        writingDate: writingDate ? new Date(writingDate) : null,
        deadline: new Date(deadline),
        status: status || ProjectStatus.NOT_STARTED,
        progress: progress || 0,
        assignedToId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
