import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all seasons
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seriesId = searchParams.get('seriesId')

    const whereClause = seriesId ? { seriesId } : {}

    const seasons = await db.season.findMany({
      where: whereClause,
      include: {
        series: {
          select: {
            name: true,
          },
        },
        _count: {
          select: { characters: true },
        },
      },
      orderBy: [
        { series: { name: 'asc' } },
        { number: 'asc' },
      ],
    })

    return NextResponse.json(seasons)
  } catch (error) {
    console.error('Error fetching seasons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    )
  }
}

// POST new season (admin only)
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
    const { seriesId, number, year } = body

    if (!seriesId || !number) {
      return NextResponse.json(
        { error: 'Series ID and season number are required' },
        { status: 400 }
      )
    }

    const season = await db.season.create({
      data: {
        seriesId,
        number,
        year,
      },
    })

    return NextResponse.json(season, { status: 201 })
  } catch (error) {
    console.error('Error creating season:', error)
    return NextResponse.json(
      { error: 'Failed to create season' },
      { status: 500 }
    )
  }
}
