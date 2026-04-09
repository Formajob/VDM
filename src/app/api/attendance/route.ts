import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const TOLERANCE_MINUTES = 5

function formatDateLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Ferme uniquement le dernier record enfant actif (pas le SHIFT parent)
async function closeActiveChild(userId: string, closeTime: Date) {
  const today = formatDateLocal(closeTime)

  const { data: openRecords } = await supabaseAdmin
    .from('Attendance')
    .select('id, startedAt, status, parentShiftId')
    .eq('userId', userId)
    .is('endedAt', null)
    .neq('status', 'SHIFT')
    .gte('startedAt', `${today}T00:00:00`)
    .order('startedAt', { ascending: false })
    .limit(1)

  if (!openRecords || openRecords.length === 0) return null

  const record = openRecords[0]
  const started = new Date(record.startedAt + 'Z')
  const durationMin = Math.max(0, Math.round((closeTime.getTime() - started.getTime()) / 60000))

  await supabaseAdmin
    .from('Attendance')
    .update({
      endedAt: closeTime.toISOString(),
      durationMin,
      updatedAt: closeTime.toISOString(),
    })
    .eq('id', record.id)

  return record
}

// ── Récupère le SHIFT parent ouvert pour un membre
async function getOpenShift(userId: string) {
  const { data } = await supabaseAdmin
    .from('Attendance')
    .select('*')
    .eq('userId', userId)
    .eq('status', 'SHIFT')
    .is('endedAt', null)
    .order('startedAt', { ascending: false })
    .limit(1)

  return data?.[0] || null
}

// ── Récupère le planning du jour pour un membre
async function getDayPlanning(userId: string, date: string) {
  const { data } = await supabaseAdmin
    .from('Planning')
    .select('*')
    .eq('userid', userId)
    .lte('weekstart', date)
    .gte('weekend', date)
    .single()

  if (!data) return null

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIndex = new Date(date + 'T12:00:00Z').getUTCDay()
  const dayName = dayNames[dayIndex]
  const dayData = data[dayName]

  if (!dayData?.startTime || !dayData?.endTime) return null

  return {
    startTime: dayData.startTime,
    endTime: dayData.endTime,
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let attendanceQuery = supabaseAdmin
      .from('Attendance')
      .select('*, user:User!Attendance_userId_fkey (id, name, email, "jobRole")')
      .order('startedAt', { ascending: false })

    const sessionUserId = (session.user as any).id
    const userRole = (session.user as any).role

    if (userRole !== 'ADMIN' && userRole !== 'MODERATEUR') {
      attendanceQuery = attendanceQuery.eq('userId', sessionUserId)
    } else if (userId) {
      attendanceQuery = attendanceQuery.eq('userId', userId)
    }

    if (date) {
      attendanceQuery = attendanceQuery
        .gte('startedAt', `${date}T00:00:00`)
        .lte('startedAt', `${date}T23:59:59`)
    } else if (dateFrom && dateTo) {
      attendanceQuery = attendanceQuery
        .gte('startedAt', `${dateFrom}T00:00:00`)
        .lte('startedAt', `${dateTo}T23:59:59`)
    }

    const { data: attendanceData, error: attendanceError } = await attendanceQuery
    if (attendanceError) throw attendanceError
    if (!attendanceData || attendanceData.length === 0) return NextResponse.json([])

    const userIds = [...new Set(attendanceData.map((a: any) => a.userId))]

    let planningQuery = supabaseAdmin.from('Planning').select('*')
    if (userIds.length === 1) {
      planningQuery = planningQuery.eq('userid', userIds[0])
    } else {
      planningQuery = planningQuery.in('userid', userIds)
    }

    const { data: allPlanning, error: planningError } = await planningQuery
    if (planningError) console.error('Planning error:', planningError)

    const dates = attendanceData.map((a: any) => a.startedAt.split('T')[0])
    const minDate = dates.sort()[0]
    const maxDate = [...dates].reverse()[0]

    const planningData = (allPlanning || []).filter((p: any) => {
      return p.weekstart <= maxDate && p.weekend >= minDate
    })

    const planningMap = new Map<string, any>()
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    planningData.forEach((p: any) => {
      const weekStart = new Date(p.weekstart)
      days.forEach((day, index) => {
        const currentDate = new Date(weekStart)
        currentDate.setDate(weekStart.getDate() + index)
        const dateStr = formatDateLocal(currentDate)
        const key = `${p.userid}_${dateStr}`
        const dayData = p[day]
        if (dayData?.startTime) {
          planningMap.set(key, dayData)
        }
      })
    })

    console.log('🗺️ Total mapped days:', planningMap.size)

    const enrichedData = attendanceData.map((record: any) => {
      const recordDate = formatDateLocal(new Date(record.startedAt))
      const planningKey = `${record.userId}_${recordDate}`
      const planning = planningMap.get(planningKey)
      const metrics = calculatePerformance(record, planning)
      return { ...record, ...metrics }
    })

    return NextResponse.json(enrichedData)
  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

function calculatePerformance(record: any, planning: any) {
  const recordDate = formatDateLocal(new Date(record.startedAt))

  if (record.status === 'ABSENT') {
    return {
      isLate: true,
      isEarlyDeparture: false,
      lateMinutes: 999,
      earlyMinutes: 0,
      plannedShift: null,
      adherencePercent: 0
    }
  }

  let plannedStart = record.plannedShiftStart
  let plannedEnd = record.plannedShiftEnd

  if (planning?.startTime) {
    plannedStart = planning.startTime
    plannedEnd = planning.endTime
  }

  if (!plannedStart || !plannedEnd) {
    return {
      isLate: false,
      isEarlyDeparture: false,
      lateMinutes: 0,
      earlyMinutes: 0,
      plannedShift: null,
      adherencePercent: 0
    }
  }

  const plannedStartTime = new Date(`${recordDate}T${plannedStart}`)
  const plannedEndTime = new Date(`${recordDate}T${plannedEnd}`)
  const actualStartTime = new Date(record.startedAt + 'Z')
  const actualEndTime = record.endedAt ? new Date(record.endedAt + 'Z') : null

  let lateMinutes = 0
  let isLate = false
  const diffStart = actualStartTime.getTime() - plannedStartTime.getTime()
  lateMinutes = Math.floor(diffStart / 60000)
  isLate = lateMinutes > TOLERANCE_MINUTES

  let earlyMinutes = 0
  let isEarlyDeparture = false
  if (actualEndTime) {
    const diffEnd = plannedEndTime.getTime() - actualEndTime.getTime()
    earlyMinutes = Math.floor(diffEnd / 60000)
    isEarlyDeparture = earlyMinutes > TOLERANCE_MINUTES
  }

  const plannedDuration = (plannedEndTime.getTime() - plannedStartTime.getTime()) / 60000
  const actualDuration = actualEndTime
    ? (actualEndTime.getTime() - actualStartTime.getTime()) / 60000
    : 0
  const adherencePercent = plannedDuration > 0
    ? Math.max(0, Math.min(100, Math.round((actualDuration / plannedDuration) * 100)))
    : 0

  return {
    isLate,
    isEarlyDeparture,
    lateMinutes: isLate ? lateMinutes : 0,
    earlyMinutes: isEarlyDeparture ? earlyMinutes : 0,
    plannedShift: { start: plannedStart, end: plannedEnd },
    adherencePercent
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const now = new Date()

    console.log('🔹 POST /api/attendance:', {
      id: body.id,
      userId: body.userId,
      targetUserId: body.targetUserId,
      status: body.status,
      forceStatus: body.forceStatus,
      fullDay: body.fullDay,
    })

    const targetUserId = body.targetUserId || body.userId
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId or targetUserId required' }, { status: 400 })
    }

    // ✅ CAS 1: DÉPART - DOIT ÊTRE EN PREMIER
    if (body.status === 'DEPART') {
      console.log('🚪 Departure for:', targetUserId)

      await closeActiveChild(targetUserId, now)

      const openShift = await getOpenShift(targetUserId)
      if (openShift) {
        const shiftStarted = new Date(openShift.startedAt + 'Z')
        const shiftDuration = Math.max(0, Math.round((now.getTime() - shiftStarted.getTime()) / 60000))

        const date = formatDateLocal(now)
        const planning = await getDayPlanning(targetUserId, date)

        let isEarlyDeparture = false
        let earlyMinutes = 0

        if (planning) {
          const plannedEnd = new Date(`${date}T${planning.endTime}:00`)
          const diff = plannedEnd.getTime() - now.getTime()
          if (diff > TOLERANCE_MINUTES * 60000) {
            isEarlyDeparture = true
            earlyMinutes = Math.round(diff / 60000)
          }
        }

        await supabaseAdmin
          .from('Attendance')
          .update({
            endedAt: now.toISOString(),
            durationMin: shiftDuration,
            isEarlyDeparture,
            earlyMinutes: isEarlyDeparture ? earlyMinutes : 0,
            updatedAt: now.toISOString(),
          })
          .eq('id', openShift.id)

        console.log('✅ SHIFT fermé:', openShift.id, isEarlyDeparture ? `DÉPART ANTICIPÉ ${earlyMinutes}min` : 'à l\'heure')
      }

      return NextResponse.json({ success: true, departed: true }, { status: 200 })
    }

    // ✅ CAS 2: Clock-out par ID
    if (body.id && body.endedAt && !body.forceStatus) {
      console.log('⏰ Clock-out for specific record:', body.id)
      
      const { data, error } = await supabaseAdmin
        .from('Attendance')
        .update({
          endedAt: body.endedAt,
          durationMin: body.durationMin,
          updatedAt: now.toISOString(),
        })
        .eq('id', body.id)
        .select()
        .single()

      if (error) {
        console.error('❌ Clock-out error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      console.log('✅ CAS 2 success:', { id: body.id, durationMin: body.durationMin })
      return NextResponse.json(data, { status: 200 })
    }

    // ✅ CAS 3: Full day status (ABSENT, CONGE)
    if (body.fullDay && body.forceStatus) {
      console.log('📅 Full day status for:', targetUserId, 'on', body.startedAt)
      const date = body.startedAt || todayStr()

      await supabaseAdmin
        .from('Attendance')
        .delete()
        .eq('userId', targetUserId)
        .gte('startedAt', `${date}T00:00:00`)
        .lte('startedAt', `${date}T23:59:59`)

      const insertData: any = {
        id: crypto.randomUUID(),
        userId: targetUserId,
        status: body.status,
        startedAt: `${date}T08:00:00`,
        endedAt: `${date}T17:00:00`,
        durationMin: 540,
        note: body.note || `Statut forcé: ${body.status}`,
        isAdjusted: true,
        adjustedBy: (session.user as any)?.id,
        adjustedAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }

      const { data, error } = await supabaseAdmin
        .from('Attendance')
        .insert(insertData)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    // ✅ CAS 4: Admin force status change (non full-day)
    if (body.forceStatus) {
      console.log('⚡ Force status for:', targetUserId, '=>', body.status)

      await closeActiveChild(targetUserId, now)

      let openShift = await getOpenShift(targetUserId)

      if (!openShift) {
        const date = formatDateLocal(now)
        const planning = await getDayPlanning(targetUserId, date)

        let isLate = false
        let lateMinutes = 0

        if (planning) {
          const plannedStart = new Date(`${date}T${planning.startTime}:00`)
          const diff = now.getTime() - plannedStart.getTime()
          if (diff > TOLERANCE_MINUTES * 60000) {
            isLate = true
            lateMinutes = Math.round(diff / 60000)
          }
        }

        const { data: shiftData } = await supabaseAdmin
          .from('Attendance')
          .insert({
            id: crypto.randomUUID(),
            userId: targetUserId,
            status: 'SHIFT',
            startedAt: now.toISOString(),
            isLate,
            lateMinutes: isLate ? lateMinutes : 0,
            plannedShiftStart: planning?.startTime || null,
            plannedShiftEnd: planning?.endTime || null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          })
          .select()
          .single()

        openShift = shiftData
        console.log('✅ SHIFT parent créé (admin):', openShift?.id)
      }

      const insertData: any = {
        id: crypto.randomUUID(),
        userId: targetUserId,
        status: body.status,
        startedAt: now.toISOString(),
        parentShiftId: openShift?.id || null,
        note: body.note || null,
        isAdjusted: true,
        adjustedBy: (session.user as any)?.id,
        adjustedAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }

      const { data, error } = await supabaseAdmin
        .from('Attendance')
        .insert(insertData)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    // ✅ CAS 5: Clock-in ou changement de statut normal (membre)
    await closeActiveChild(targetUserId, now)

    let openShift = await getOpenShift(targetUserId)

    if (!openShift) {
      const date = formatDateLocal(now)
      const planning = await getDayPlanning(targetUserId, date)

      let isLate = false
      let lateMinutes = 0

      if (planning) {
        const plannedStart = new Date(`${date}T${planning.startTime}:00`)
        const diff = now.getTime() - plannedStart.getTime()
        if (diff > TOLERANCE_MINUTES * 60000) {
          isLate = true
          lateMinutes = Math.round(diff / 60000)
        }
      }

      const { data: shiftData } = await supabaseAdmin
        .from('Attendance')
        .insert({
          id: crypto.randomUUID(),
          userId: targetUserId,
          status: 'SHIFT',
          startedAt: now.toISOString(),
          isLate,
          lateMinutes: isLate ? lateMinutes : 0,
          plannedShiftStart: planning?.startTime || null,
          plannedShiftEnd: planning?.endTime || null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .select()
        .single()

      openShift = shiftData
      console.log('✅ SHIFT parent créé:', openShift?.id, isLate ? `RETARD ${lateMinutes}min` : 'à l\'heure')
    }

    const insertData: any = {
      id: crypto.randomUUID(),
      userId: targetUserId,
      status: body.status || 'EN_PRODUCTION',
      startedAt: now.toISOString(),
      parentShiftId: openShift?.id || null,
      note: body.note || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('Attendance')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('❌ Error in POST /api/attendance:', error)
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('Attendance')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attendance:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const now = new Date()

    const { data, error } = await supabaseAdmin
      .from('Attendance')
      .update({
        status: body.status,
        startedAt: body.startedAt,
        endedAt: body.endedAt,
        durationMin: body.durationMin,
        note: body.note,
        isAdjusted: body.isAdjustment || false,
        adjustedBy: body.isAdjustment ? (session.user as any).id : null,
        adjustedAt: body.isAdjustment ? now.toISOString() : null,
        adjustmentNote: body.adjustmentNote || null,
        overrideIsLate: body.overrideIsLate,
        overrideIsEarly: body.overrideIsEarly,
        updatedAt: now.toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating attendance:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}