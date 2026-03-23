import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ProjectStatus } from '@prisma/client'

// GET single project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const project = await db.project.findUnique({
      where: { id: params.id },
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

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    // Members can only view their own projects
    if (userRole !== 'ADMIN' && project.assignedToId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

// PATCH update project
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status, progress } = body

    const project = await db.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    // Members can only update their own projects (status and progress only)
    if (userRole !== 'ADMIN' && project.assignedToId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const updateData: any = {}

    if (status !== undefined) {
      updateData.status = status
      // Auto-update progress based on status
      if (status === ProjectStatus.DONE) {
        updateData.progress = 100
      } else if (status === ProjectStatus.NOT_STARTED) {
        updateData.progress = 0
      }
    }

    if (progress !== undefined) {
      updateData.progress = progress
      // Auto-update status based on progress
      if (progress === 100) {
        updateData.status = ProjectStatus.DONE
      } else if (progress > 0) {
        updateData.status = ProjectStatus.IN_PROGRESS
      } else if (progress === 0) {
        updateData.status = ProjectStatus.NOT_STARTED
      }
    }

    // Admin can update all fields
    if (userRole === 'ADMIN') {
      if (body.name) updateData.name = body.name
      if (body.seriesName) updateData.seriesName = body.seriesName
      if (body.season) updateData.season = body.season
      if (body.pageCount !== undefined) updateData.pageCount = body.pageCount
      if (body.writingDate !== undefined) {
        updateData.writingDate = body.writingDate ? new Date(body.writingDate) : null
      }
      if (body.deadline) updateData.deadline = new Date(body.deadline)
      if (body.assignedToId) updateData.assignedToId = body.assignedToId
    }

    const updatedProject = await db.project.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

// DELETE project (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    await db.project.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
