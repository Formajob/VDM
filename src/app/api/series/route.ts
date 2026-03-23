import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all series
export async function GET() {
  try {
    const series = await db.series.findMany({
      include: {
        seasons: {
          include: {
            _count: {
              select: { characters: true },
            },
          },
          orderBy: { number: 'asc' },
        },
        _count: {
          select: { seasons: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(series)
  } catch (error) {
    console.error('Error fetching series:', error)
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    )
  }
}

// POST new series (admin only)
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
    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const series = await db.series.create({
      data: {
        name,
        description,
      },
    })

    return NextResponse.json(series, { status: 201 })
  } catch (error) {
    console.error('Error creating series:', error)
    return NextResponse.json(
      { error: 'Failed to create series' },
      { status: 500 }
    )
  }
}
