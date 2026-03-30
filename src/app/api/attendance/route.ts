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

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const date = searchParams.get('date')
    const all = searchParams.get('all')

    let attendanceQuery = supabaseAdmin
      .from('Attendance')
      .select('*, user:User!Attendance_userId_fkey (id, name, email, "jobRole")')
      .order('startedAt', { ascending: false })

    if (userId && userId !== 'all') {
      attendanceQuery = attendanceQuery.eq('userId', userId)
    }

    if (date) {
      attendanceQuery = attendanceQuery.gte('startedAt', `${date}T00:00:00`).lte('startedAt', `${date}T23:59:59`)
    } else if (startDate && endDate) {
      attendanceQuery = attendanceQuery.gte('startedAt', `${startDate}T00:00:00`).lte('startedAt', `${endDate}T23:59:59`)
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
        if (dayData?.shift) {
          planningMap.set(key, { shift: dayData.shift })
        }
      })
    })

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
  
  if (planning?.shift) {
    const [s, e] = planning.shift.split('-')
    plannedStart = s
    plannedEnd = e
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
  
  const plannedStartTime = new Date(`${recordDate}T${plannedStart}Z`)
  const plannedEndTime = new Date(`${recordDate}T${plannedEnd}Z`)
  const actualStartTime = new Date(record.startedAt + 'Z')
  const actualEndTime = record.endedAt ? new Date(record.endedAt + 'Z') : null

  let lateMinutes = 0
  let isLate = false
  if (actualStartTime && plannedStartTime) {
    const diffMs = actualStartTime.getTime() - plannedStartTime.getTime()
    lateMinutes = Math.floor(diffMs / 60000)
    isLate = lateMinutes > TOLERANCE_MINUTES
  }

  let earlyMinutes = 0
  let isEarlyDeparture = false
  if (actualEndTime && plannedEndTime) {
    const diffMs = plannedEndTime.getTime() - actualEndTime.getTime()
    earlyMinutes = Math.floor(diffMs / 60000)
    isEarlyDeparture = earlyMinutes > TOLERANCE_MINUTES
  }

  const plannedDuration = (plannedEndTime.getTime() - plannedStartTime.getTime()) / 60000
  const actualDuration = actualEndTime ? (actualEndTime.getTime() - actualStartTime.getTime()) / 60000 : 0
  const adherencePercent = plannedDuration > 0 ? Math.max(0, Math.min(100, Math.round((actualDuration / plannedDuration) * 100))) : 0

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

    console.log('🔹 POST /api/attendance:', body)

    // ✅ CAS 1: Clock-out par ID (mise à jour d'un record EXISTANT) - DOIT ÊTRE EN PREMIER !
   if (body.id && body.endedAt && !body.forceStatus) {
  console.log('⏰ Clock-out for specific record:', body.id)
  
  const { data, error } = await supabaseAdmin
    .from('Attendance')
    .update({
      endedAt: body.endedAt,
      durationMin: body.durationMin,
      updatedAt: now.toISOString(),
    })
    .eq('id', body.id)  // ← Ne met à jour QUE ce record
    .select()
    .single()

  if (error) {
    console.error('❌ Clock-out error:', error)
    throw error
  }
  
  console.log('✅ CAS 1 success:', { id: body.id, durationMin: body.durationMin })
  return NextResponse.json(data, { status: 200 })  // ← RETURN IMMÉDIAT, ne pas continuer !
}

    const targetUserId = body.targetUserId || body.userId
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId or targetUserId required' }, { status: 400 })
    }

    // ✅ FONCTION: Fermer tout record ouvert pour cet utilisateur aujourd'hui
    async function closeOpenRecord(userId: string, closeTime: Date, isDeparture: boolean = false) {
      const today = formatDateLocal(closeTime)
      
      // ✅ CORRECTION:  data: openRecords (déstructuration correcte)
      const { data: openRecords, error: fetchError } = await supabaseAdmin
        .from('Attendance')
        .select('id, startedAt, status')
        .eq('userId', userId)
        .is('endedAt', null)
        .gte('startedAt', `${today}T00:00:00`)
        .lte('startedAt', `${today}T23:59:59`)

      if (fetchError) {
        console.error('Error fetching open records:', fetchError)
        return
      }

      if (openRecords && openRecords.length > 0) {
        console.log('🔒 Closing', openRecords.length, 'open record(s)')
        
        for (const record of openRecords) {
          // ✅ CORRECTION: Ajouter 'Z' si absent pour forcer UTC
          const startedAtStr = record.startedAt.endsWith('Z') 
            ? record.startedAt 
            : record.startedAt + 'Z'
          
          const started = new Date(startedAtStr)
          const durationMin = Math.max(0, Math.round((closeTime.getTime() - started.getTime()) / 60000))
          
          let isEarlyDeparture = false
          let earlyMinutes = 0
          let isLate = false
          let lateMinutes = 0
          
          if (record.status === 'EN_PRODUCTION') {
            // ✅ CORRECTION:  data: planning (déstructuration correcte)
            const { data: planning } = await supabaseAdmin
              .from('Planning')
              .select('*')
              .eq('userid', userId)
              .lte('weekstart', today)
              .gte('weekend', today)
              .single()
            
            if (planning) {
              const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
              const todayDate = new Date(today + 'T00:00:00Z')
              const weekStart = new Date(planning.weekstart + 'T00:00:00Z')
              const dayIndex = Math.floor((todayDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
              
              if (dayIndex >= 0 && dayIndex < 7) {
                const dayName = days[dayIndex]
                if (planning[dayName]?.shift) {
                  const [plannedStart, plannedEnd] = planning[dayName].shift.split('-')
                  
                  const plannedStartTime = new Date(`${today}T${plannedStart}Z`)
                  const plannedEndTime = new Date(`${today}T${plannedEnd}Z`)
                  const actualStart = new Date(startedAtStr)
                  
                  if (actualStart > plannedStartTime) {
                    lateMinutes = Math.round((actualStart.getTime() - plannedStartTime.getTime()) / 60000)
                    if (lateMinutes > 5) isLate = true
                  }
                  
                  if (isDeparture && closeTime < plannedEndTime) {
                    isEarlyDeparture = true
                    earlyMinutes = Math.round((plannedEndTime.getTime() - closeTime.getTime()) / 60000)
                  }
                }
              }
            }
          }
          
          console.log('  - Closing record:', {
            id: record.id,
            status: record.status,
            durationMin,
            isLate,
            isEarlyDeparture
          })
          
          await supabaseAdmin
            .from('Attendance')
            .update({
              endedAt: closeTime.toISOString(),
              durationMin: durationMin,
              ...(record.status === 'EN_PRODUCTION' && {
                isLate,
                lateMinutes: isLate ? lateMinutes : null,
                isEarlyDeparture,
                earlyMinutes: isEarlyDeparture ? earlyMinutes : null,
              }),
              updatedAt: closeTime.toISOString(),
            })
            .eq('id', record.id)
        }
      }
    }

    if (body.fullDay && body.forceStatus) {
      const date = body.startedAt || formatDateLocal(now)
      
      await supabaseAdmin
        .from('Attendance')
        .delete()
        .eq('userId', targetUserId)
        .gte('startedAt', `${date}T00:00:00`)
        .lte('startedAt', `${date}T23:59:59`)
      
      const insertData: any = {
        id: body.id || crypto.randomUUID(),
        userId: targetUserId,
        status: body.status,
        startedAt: `${date}T08:00:00Z`,
        endedAt: `${date}T17:00:00Z`,
        durationMin: 540,
        note: body.note || `Statut forcé: ${body.status}`,
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

    if (body.forceStatus) {
      await closeOpenRecord(targetUserId, now, false)
      
      const insertData: any = {
        id: body.id || crypto.randomUUID(),
        userId: targetUserId,
        status: body.status,
        startedAt: body.startedAt || now.toISOString(),
        endedAt: body.endedAt || null,
        durationMin: body.durationMin || null,
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
    }

    if (body.status === 'DEPART' || body.action === 'depart') {
      await closeOpenRecord(targetUserId, now, true)
      return NextResponse.json({ success: true, message: 'Departure recorded' }, { status: 200 })
    }

    await closeOpenRecord(targetUserId, now, false)

    const insertData: any = {
      id: body.id || crypto.randomUUID(),
      userId: targetUserId,
      status: body.status || 'EN_PRODUCTION',
      startedAt: body.startedAt || now.toISOString(),
      endedAt: body.endedAt || null,
      durationMin: body.durationMin || null,
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

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
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