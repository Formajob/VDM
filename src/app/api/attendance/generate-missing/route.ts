import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { startDate, endDate, userId } = body

    console.log('🔹 Generating absences from', startDate, 'to', endDate, 'for user:', userId || 'all')

    // Fetch all members
    const {  data: members } = await supabaseAdmin
      .from('User')
      .select('id, name, email')
      .eq('role', 'MEMBER')

    if (!members || members.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No members found' })
    }

    console.log('👥 Found', members.length, 'members')

    const generatedRecords: any[] = []
    const today = new Date().toISOString().split('T')[0]
    const effectiveStartDate = startDate || '2000-01-01'
    const effectiveEndDate = endDate || today

    // Pour chaque membre
    for (const member of members) {
      if (userId && member.id !== userId) continue

      // Fetch planning pour la période
      const {  data: plannings } = await supabaseAdmin
        .from('Planning')
        .select('*')
        .eq('userid', member.id)
        .gte('weekstart', effectiveStartDate)
        .lte('weekend', effectiveEndDate)

      if (!plannings || plannings.length === 0) {
        console.log(`⚠️ No planning for ${member.name} in this period`)
        continue
      }

      console.log(`📅 Found ${plannings.length} planning weeks for ${member.name}`)

      // Pour chaque semaine de planning
      for (const planning of plannings) {
        // Pour chaque jour de la semaine
        for (const day of days) {
          const dayData = planning[day as keyof typeof planning] as { shift?: string; status?: string } | null
          
          // Skip si pas de shift ou si OFF/CONGE
          if (!dayData?.shift || dayData.status === 'OFF' || dayData.status === 'CONGE') {
            continue
          }

          // Calculer la date du jour
          const weekStart = new Date(planning.weekstart)
          const dayIndex = days.indexOf(day)
          const currentDate = new Date(weekStart)
          currentDate.setDate(weekStart.getDate() + dayIndex)
          const dateStr = currentDate.toISOString().split('T')[0]

          // Skip les jours futurs
          if (dateStr > today) {
            console.log(`⏭️ Skip future date ${dateStr} for ${member.name}`)
            continue
          }

          // Vérifier si un pointage existe déjà pour ce jour
          const {  data: existingAttendance } = await supabaseAdmin
            .from('Attendance')
            .select('id, status')
            .eq('userId', member.id)
            .gte('startedAt', `${dateStr}T00:00:00`)
            .lte('startedAt', `${dateStr}T23:59:59`)

          if (existingAttendance && existingAttendance.length > 0) {
            console.log(`✅ Attendance exists for ${member.name} on ${dateStr} (${existingAttendance[0].status})`)
            continue
          }

          // Créer un record ABSENT
          const [shiftStart] = dayData.shift.split('-')
          const [shiftEnd] = dayData.shift.split('-')
          const recordId = `absent_${member.id}_${dateStr}`
          
          // ✅ CORRECTION: Utiliser insert() au lieu de upsert()
          const {  data: inserted, error } = await supabaseAdmin
            .from('Attendance')
            .insert({
              id: recordId,
              userId: member.id,
              status: 'ABSENT',
              startedAt: `${dateStr}T${shiftStart}`,
              endedAt: null,
              durationMin: 0,
              note: 'Absence automatique - aucun pointage enregistré',
              isLate: true,
              lateMinutes: 999,
              isEarlyDeparture: false,
              earlyMinutes: 0,
              plannedShiftStart: shiftStart,
              plannedShiftEnd: dayData.shift.split('-')[1],
              adherencePercent: 0,
              isAdjusted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .select()
            .single()

          if (error) {
            // Si erreur de conflit (déjà existe), on ignore
            if (error.code === '23505') {
              console.log(`⚠️ Record already exists for ${member.name} on ${dateStr}`)
              continue
            }
            console.error(`❌ Error creating absence for ${member.name}:`, error)
            continue
          }

          if (inserted) {
            generatedRecords.push(inserted)
            console.log(`📝 ABSENT record created for ${member.name} on ${dateStr}`)
          }
        }
      }
    }

    console.log('✅ Generated', generatedRecords.length, 'absence records')
    return NextResponse.json({ 
      success: true, 
      count: generatedRecords.length, 
      records: generatedRecords 
    })
  } catch (error) {
    console.error('❌ Error generating missing records:', error)
    return NextResponse.json({ 
      error: 'Failed to generate records',
      details: String(error)
    }, { status: 500 })
  }
}