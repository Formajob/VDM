import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET single character
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const character = await db.character.findUnique({
      where: { id: params.id },
      include: {
        season: {
          include: {
            series: true,
          },
        },
      },
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(character)
  } catch (error) {
    console.error('Error fetching character:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character' },
      { status: 500 }
    )
  }
}

// PATCH update character (admin only)
export async function PATCH(
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

    const body = await request.json()
    const { name, actorName, photoUrl, seasonId } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (actorName !== undefined) updateData.actorName = actorName
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl
    if (seasonId !== undefined) updateData.seasonId = seasonId

    const character = await db.character.update({
      where: { id: params.id },
      data: updateData,
      include: {
        season: {
          include: {
            series: true,
          },
        },
      },
    })

    return NextResponse.json(character)
  } catch (error) {
    console.error('Error updating character:', error)
    return NextResponse.json(
      { error: 'Failed to update character' },
      { status: 500 }
    )
  }
}

// DELETE character (admin only)
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

    await db.character.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting character:', error)
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 }
    )
  }
}
