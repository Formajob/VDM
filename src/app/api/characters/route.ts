import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all characters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')
    const search = searchParams.get('search')

    const whereClause: any = {}

    if (seasonId) {
      whereClause.seasonId = seasonId
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { actorName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const characters = await db.character.findMany({
      where: whereClause,
      include: {
        season: {
          include: {
            series: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(characters)
  } catch (error) {
    console.error('Error fetching characters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characters' },
      { status: 500 }
    )
  }
}

// POST new character (admin only)
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
    const { name, actorName, photoUrl, seasonId } = body

    if (!name || !actorName || !seasonId) {
      return NextResponse.json(
        { error: 'Name, actor name, and season ID are required' },
        { status: 400 }
      )
    }

    const character = await db.character.create({
      data: {
        name,
        actorName,
        photoUrl,
        seasonId,
      },
    })

    return NextResponse.json(character, { status: 201 })
  } catch (error) {
    console.error('Error creating character:', error)
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    )
  }
}
