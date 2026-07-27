import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// ✅ FONCTION UTILITAIRE : Extrait YYYY-MM-DD en heure locale (anti-bug fuseau horaire)
const getLocalDateStr = (dateInput: string | null | undefined) => {
  if (!dateInput) return null
  const date = new Date(dateInput)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    
    const period = searchParams.get('period') || 'week'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const team = searchParams.get('team') || 'all'
    const requestedMemberId = searchParams.get('memberId') || searchParams.get('memberIds')
    const includeTeam = searchParams.get('includeTeam') === 'true'

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const isMember = userRole === 'MEMBER'

    let finalMemberId = requestedMemberId
    if (isMember) {
      finalMemberId = userId
    }

    const now = new Date()
    let startDate: string, endDate: string
    
    if (dateFrom && dateTo) {
      startDate = dateFrom
      endDate = dateTo
    } else if (period === 'today') {
      startDate = now.toISOString().split('T')[0]
      endDate = startDate
    } else if (period === 'week') {
      const day = now.getDay() || 7
      const sunday = new Date(now)
  sunday.setDate(now.getDate() - day) // Retour au dimanche
       const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6) // Samedi
  startDate = sunday.toISOString().split('T')[0]
  endDate = saturday.toISOString().split('T')[0]
    } else if (period === 'month') {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      endDate = now.toISOString().split('T')[0]
    } else if (period === 'year') {
      startDate = `${now.getFullYear()}-01-01`
      endDate = `${now.getFullYear()}-12-31`
    } else {
      startDate = now.toISOString().split('T')[0]
      endDate = startDate
    }

    const daysInPeriod = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    
    const getObjectiveForRole = (jobRole: string, days: number) => {
      if (jobRole === 'TECH_SON') {
        return Math.round((5000 / 30) * days)
      }
      return 200 * days
    }

    const getDailyObjectiveForRole = (jobRole: string) => {
      return jobRole === 'TECH_SON' ? 167 : 200
    }

    let allUsersQuery = supabaseAdmin
      .from('User')
      .select('id, name, jobRole')
      .eq('role', 'MEMBER')
      .in('jobRole', ['REDACTEUR', 'TECH_SON'])
      .order('name')

    const { data: allUsersAll, error: usersAllError } = await allUsersQuery
    if (usersAllError) {
      return NextResponse.json({ error: usersAllError.message }, { status: 500 })
    }

    let filteredUsers = allUsersAll || []

    if (finalMemberId && finalMemberId !== 'all' && !includeTeam) {
      filteredUsers = filteredUsers.filter(u => u.id === finalMemberId)
    } else if (finalMemberId && finalMemberId !== 'all' && includeTeam) {
      const memberUser = allUsersAll?.find(u => u.id === finalMemberId)
      const memberJobRole = memberUser?.jobRole
      if (memberJobRole === 'REDACTEUR') {
        filteredUsers = filteredUsers.filter(u => u.jobRole === 'REDACTEUR')
      } else if (memberJobRole === 'TECH_SON') {
        filteredUsers = filteredUsers.filter(u => u.jobRole === 'TECH_SON')
      }
    } else if (team === 'redaction') {
      filteredUsers = filteredUsers.filter(u => u.jobRole === 'REDACTEUR')
    } else if (team === 'mixage') {
      filteredUsers = filteredUsers.filter(u => u.jobRole === 'TECH_SON')
    }

    let projectQuery = supabaseAdmin
      .from('Project')
      .select('*')
      .or('isWritten.eq.true,isMixed.eq.true')

    const { data: allProjects, error: projectsError } = await projectQuery
    
    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 })
    }

    // ✅ FILTRAGE SÉCURISÉ CONTRE LES DÉCALAGES DE FUSEAU HORAIRE
    const filteredProjects = allProjects?.filter((p: any) => {
      const isRedacteurProject = p.isWritten && p.redacteurId && filteredUsers.some(u => u.jobRole === 'REDACTEUR' && u.id === p.redacteurId)
      const isTechSonProject = p.isMixed && p.techSonId && filteredUsers.some(u => u.jobRole === 'TECH_SON' && u.id === p.techSonId)
      
      if (!isRedacteurProject && !isTechSonProject) return false
      
      const projectDateStr = isRedacteurProject ? p.writtenAt : p.mixedAt
      if (!projectDateStr) return false
      
      // ✅ Compare les chaînes YYYY-MM-DD en heure locale (plus de décalage d'un jour)
      const projectLocalDate = getLocalDateStr(projectDateStr)
      if (!projectLocalDate) return false
      
      return projectLocalDate >= startDate && projectLocalDate <= endDate
    }) || []

    const tempPerformance = filteredUsers?.map(user => {
      const userProjects = filteredProjects?.filter((p: any) => {
        if (user.jobRole === 'TECH_SON') {
          return p.techSonId === user.id
        } else {
          return p.redacteurId === user.id
        }
      }) || []
      
      const totalMinutes = Math.round(userProjects.reduce((sum: number, p: any) => sum + (p.durationMin || 0), 0))
      const projectCount = userProjects.length
      const userObjective = getObjectiveForRole(user.jobRole, daysInPeriod)
      
      return {
        userId: user.id,
        name: user.name,
        jobRole: user.jobRole,
        projectCount,
        totalMinutes,
        objectif: userObjective,
        objectifJournalier: getDailyObjectiveForRole(user.jobRole),
        ecart: totalMinutes - userObjective,
        moyenneJour: daysInPeriod > 0 ? Math.round(totalMinutes / daysInPeriod) : 0,
        projects: userProjects
      }
    }) || []

    const performanceByMember = tempPerformance
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((member, index) => ({
        ...member,
        rang: index + 1,
        totalMembres: tempPerformance.length || 1
      }))

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
      totalMinutes: performanceByMember.reduce((sum: number, m: any) => sum + m.totalMinutes, 0),
      objectif: performanceByMember.reduce((sum: number, m: any) => sum + m.objectif, 0),
      pourcentage: performanceByMember.length > 0 
        ? Math.round((performanceByMember.reduce((sum: number, m: any) => sum + m.totalMinutes, 0) / performanceByMember.reduce((sum: number, m: any) => sum + m.objectif, 0)) * 100) 
        : 0
    }

    const daysInPeriodArray: Array<{ date: string; label: string }> = []
    const currentDate = new Date(startDate)
    while (currentDate <= new Date(endDate)) {
      daysInPeriodArray.push({
        date: currentDate.toISOString().split('T')[0],
        label: currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // ✅ VUE QUOTIDIENNE SÉCURISÉE
    const dailyPerformance = daysInPeriodArray.map(day => {
      const dayProjects = filteredProjects?.filter((p: any) => {
        const isRedacteur = p.isWritten && p.redacteurId
        const dateStr = isRedacteur ? p.writtenAt : p.mixedAt
        const projectLocalDate = getLocalDateStr(dateStr)
        return projectLocalDate === day.date
      }) || []
      
      const byMember: Record<string, { minutes: number; count: number }> = {}
      filteredUsers?.forEach(user => {
        const userDayProjects = dayProjects.filter((p: any) => {
          if (user.jobRole === 'TECH_SON') {
            return p.techSonId === user.id
          } else {
            return p.redacteurId === user.id
          }
        })
        byMember[user.id] = {
          minutes: Math.round(userDayProjects.reduce((sum: number, p: any) => sum + (p.durationMin || 0), 0)),
          count: userDayProjects.length
        }
      })
      return { date: day.date, label: day.label, byMember }
    })

    const totalProjects = filteredProjects?.length || 0
    const totalMinutes = filteredProjects?.reduce((sum: number, p: any) => sum + (p.durationMin || 0), 0) || 0
    const moyenneJourGlobal = daysInPeriod > 0 ? Math.round(totalMinutes / daysInPeriod) : 0

    const alerts: Array<{ type: string; message: string; severity: string }> = []
    if (teamStats.pourcentage < 50) {
      alerts.push({ type: 'LOW_PERFORMANCE', message: `Performance: ${teamStats.pourcentage}% de l'objectif`, severity: 'error' })
    } else if (teamStats.pourcentage < 80) {
      alerts.push({ type: 'MODERATE_PERFORMANCE', message: `Performance: ${teamStats.pourcentage}% de l'objectif`, severity: 'warning' })
    }

    return NextResponse.json({
      period: { startDate, endDate, days: daysInPeriod },
      performanceByMember,
      dailyPerformance,
      teamStats,
      statsByTeam,
      stats: {
        totalProjects,
        totalMinutes: Math.round(totalMinutes),
        moyenneJour: moyenneJourGlobal,
        memberCount: filteredUsers?.length || 0,
        classement: performanceByMember.slice(0, 3).map((m: any) => ({ nom: m.name, minutes: m.totalMinutes, rang: m.rang }))
      },
      alerts,
      projects: filteredProjects
    })
  } catch (e: any) {
    console.error('❌ Performance API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}