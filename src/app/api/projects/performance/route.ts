import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const getLocalDateStr = (dateInput: string | null | undefined): string | null => {
  if (!dateInput) return null
  return String(dateInput).slice(0, 10)
}

const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom') || '2026-07-01'
    const dateTo = searchParams.get('dateTo') || '2026-07-31'
    const team = searchParams.get('team') || 'all'
    const requestedMemberId = searchParams.get('memberId') || searchParams.get('memberIds')

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const isMember = userRole === 'MEMBER'

    let finalMemberId = requestedMemberId
    if (isMember) finalMemberId = userId

    // 1. Récupérer TOUS les utilisateurs REDACTEUR et TECH_SON
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('User')
      .select('id, name, jobRole, role')
      .in('jobRole', ['REDACTEUR', 'TECH_SON'])

    if (usersError) throw usersError

    let filteredUsers = allUsers || []
    if (finalMemberId && finalMemberId !== 'all') {
      const member = allUsers.find(u => u.id === finalMemberId)
      if (member) {
        filteredUsers = allUsers.filter(u => u.jobRole === member.jobRole)
      }
    } else if (team === 'redaction') {
      filteredUsers = allUsers.filter(u => u.jobRole === 'REDACTEUR')
    } else if (team === 'mixage') {
      filteredUsers = allUsers.filter(u => u.jobRole === 'TECH_SON')
    }

    // 2. Récupérer TOUS les projets
    const { data: allProjects, error: projectsError } = await supabaseAdmin
      .from('Project')
      .select('*')

    if (projectsError) throw projectsError

    // 3. Filtrage des projets par période et par utilisateur
    const filteredProjects = allProjects.filter((p: any) => {
      const dateStr = p.isWritten ? p.writtenAt : (p.isMixed ? p.mixedAt : null)
      if (!dateStr) return false

      const projectDate = String(dateStr).slice(0, 10)
      if (projectDate < dateFrom || projectDate > dateTo) return false

      const isRedacteur = p.isWritten && filteredUsers.some(u => u.jobRole === 'REDACTEUR' && u.id === p.redacteurId)
      const isTechSon = p.isMixed && filteredUsers.some(u => u.jobRole === 'TECH_SON' && u.id === p.techSonId)

      return isRedacteur || isTechSon
    })

    // 4. Calculer les performances par membre
    const performanceByMember = filteredUsers.map(user => {
      const userProjects = filteredProjects.filter(p =>
        user.jobRole === 'TECH_SON' ? p.techSonId === user.id : p.redacteurId === user.id
      )
      const mins = Math.round(userProjects.reduce((sum: number, p: any) => sum + (Number(p.durationMin) || 0), 0))

      return {
        userId: user.id,
        name: user.name,
        jobRole: user.jobRole,
        projectCount: userProjects.length,
        totalMinutes: mins,
        objectif: 200,
        ecart: mins - 200,
        moyenneJour: mins,
        rang: 0,
        projects: userProjects
      }
    }).sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((m, i) => ({ ...m, rang: i + 1 }))

    // 5. ✅ RESTAURATION : Générer la liste des jours de la période
    const daysInPeriodArray: Array<{ date: string; label: string }> = []
    const startCursor = new Date(`${dateFrom}T00:00:00`)
    const endCursor = new Date(`${dateTo}T00:00:00`)
    while (startCursor <= endCursor) {
      daysInPeriodArray.push({
        date: formatDate(startCursor),
        label: startCursor.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      })
      startCursor.setDate(startCursor.getDate() + 1)
    }

    // 6. ✅ RESTAURATION : Calculer dailyPerformance (vue par jour)
    const dailyPerformance = daysInPeriodArray.map(day => {
      const dayProjects = filteredProjects.filter((p: any) => {
        const dateStr = p.isWritten ? p.writtenAt : p.mixedAt
        const projectDate = String(dateStr).slice(0, 10)
        return projectDate === day.date
      })

      const byMember: Record<string, { minutes: number; count: number }> = {}
      filteredUsers.forEach(user => {
        const userDayProjects = dayProjects.filter((p: any) =>
          user.jobRole === 'TECH_SON' ? p.techSonId === user.id : p.redacteurId === user.id
        )
        byMember[user.id] = {
          minutes: Math.round(userDayProjects.reduce((sum: number, p: any) => sum + (Number(p.durationMin) || 0), 0)),
          count: userDayProjects.length
        }
      })

      return { date: day.date, label: day.label, byMember }
    })

    // 7. Stats globales
    const totalMinutes = Math.round(filteredProjects.reduce((sum: number, p: any) => sum + (Number(p.durationMin) || 0), 0))
    const totalProjects = filteredProjects.length
    const totalObjectif = performanceByMember.reduce((sum: number, m: any) => sum + m.objectif, 0)

    const redactionMembers = performanceByMember.filter((m: any) => m.jobRole === 'REDACTEUR')
    const mixageMembers = performanceByMember.filter((m: any) => m.jobRole === 'TECH_SON')

    const statsByTeam = {
      redaction: {
        members: redactionMembers.length,
        minutes: redactionMembers.reduce((sum: number, m: any) => sum + m.totalMinutes, 0),
        objectif: redactionMembers.reduce((sum: number, m: any) => sum + m.objectif, 0)
      },
      mixage: {
        members: mixageMembers.length,
        minutes: mixageMembers.reduce((sum: number, m: any) => sum + m.totalMinutes, 0),
        objectif: mixageMembers.reduce((sum: number, m: any) => sum + m.objectif, 0)
      }
    }

    const teamStats = {
      totalMinutes,
      objectif: totalObjectif,
      pourcentage: totalObjectif > 0 ? Math.round((totalMinutes / totalObjectif) * 100) : 0
    }

    const alerts: Array<{ type: string; message: string; severity: string }> = []
    if (teamStats.pourcentage < 50) {
      alerts.push({ type: 'LOW_PERFORMANCE', message: `Performance: ${teamStats.pourcentage}% de l'objectif`, severity: 'error' })
    } else if (teamStats.pourcentage < 80) {
      alerts.push({ type: 'MODERATE_PERFORMANCE', message: `Performance: ${teamStats.pourcentage}% de l'objectif`, severity: 'warning' })
    }

    return NextResponse.json({
      period: { startDate: dateFrom, endDate: dateTo, days: daysInPeriodArray.length },
      performanceByMember,
      dailyPerformance, // ✅ Maintenant rempli avec les vraies données
      teamStats,
      statsByTeam,
      stats: {
        totalProjects,
        totalMinutes,
        moyenneJour: daysInPeriodArray.length > 0 ? Math.round(totalMinutes / daysInPeriodArray.length) : 0,
        memberCount: filteredUsers.length,
        classement: performanceByMember.slice(0, 3).map((m: any) => ({ nom: m.name, minutes: m.totalMinutes, rang: m.rang }))
      },
      alerts,
      projects: filteredProjects
    })
  } catch (e: any) {
    console.error('❌ API Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}