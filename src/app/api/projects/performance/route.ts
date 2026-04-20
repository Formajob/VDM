// src/app/api/projects/performance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    
    const period = searchParams.get('period') || 'week'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const team = searchParams.get('team') || 'all'
    const requestedMemberId = searchParams.get('memberId')
    const includeTeam = searchParams.get('includeTeam') === 'true'

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const isMember = userRole === 'MEMBER'
    const isAdmin = userRole === 'ADMIN'

    let finalMemberId = requestedMemberId
    if (isMember) {
      finalMemberId = userId
    }

    // ✅ CORRECTION 1: Calculer la période basée sur mixedAt/writtenAt, pas createdAt
    const now = new Date()
    let startDate: string, endDate: string
    
    if (period === 'custom' && dateFrom && dateTo) {
      startDate = dateFrom
      endDate = dateTo
    } else if (period === 'today') {
      startDate = now.toISOString().split('T')[0]
      endDate = startDate
    } else if (period === 'week') {
      const day = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - day + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      startDate = monday.toISOString().split('T')[0]
      endDate = sunday.toISOString().split('T')[0]
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

    console.log('🔍 [PERFORMANCE API] Period:', { period, startDate, endDate, team, finalMemberId })

    // ✅ Objectifs DIFFÉRENCIÉS par rôle
    const daysInPeriod = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    
    const getObjectiveForRole = (jobRole: string, days: number) => {
      if (jobRole === 'TECH_SON') {
        const dailyObjective = 5000 / 30
        return Math.round(dailyObjective * days)
      }
      return 200 * days
    }

    const getDailyObjectiveForRole = (jobRole: string) => {
      return jobRole === 'TECH_SON' ? 167 : 200
    }

    // ✅ Récupérer TOUS les utilisateurs
    let allUsersQuery = supabaseAdmin
      .from('User')
      .select('id, name, jobRole')
      .eq('role', 'MEMBER')
      .in('jobRole', ['REDACTEUR', 'TECH_SON'])
      .order('name')

    const { data: allUsersAll, error: usersAllError } = await allUsersQuery
    if (usersAllError) {
      console.error('❌ Users all error:', usersAllError)
      return NextResponse.json({ error: usersAllError.message }, { status: 500 })
    }

    // ✅ Filtrer les utilisateurs selon le contexte
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

    console.log('📊 [PERFORMANCE API] Filtered users:', filteredUsers.length, 'Team:', team)

    // ✅ CORRECTION 2: Récupérer TOUS les projets pertinents, puis filtrer côté client
    let projectQuery = supabaseAdmin
      .from('Project')
      .select('*')
      .eq('status', 'FAIT')

    // ✅ Pour Tech Son: récupérer tous les projets isMixed=true
    // ✅ Pour Rédacteur: récupérer tous les projets isWritten=true
    if (team === 'mixage' || filteredUsers.some(u => u.jobRole === 'TECH_SON')) {
      projectQuery = projectQuery.eq('isMixed', true)
    } else if (team === 'redaction' || filteredUsers.some(u => u.jobRole === 'REDACTEUR')) {
      projectQuery = projectQuery.eq('isWritten', true)
    }

    const { data: allProjects, error: projectsError } = await projectQuery
    
    if (projectsError) {
      console.error('❌ Projects error:', projectsError)
      return NextResponse.json({ error: projectsError.message }, { status: 500 })
    }

    console.log('📦 [PERFORMANCE API] All projects:', allProjects?.length)

    // ✅ CORRECTION 3: Filtrer côté client par mixedAt/writtenAt selon le rôle
    const filteredProjects = allProjects?.filter((p: any) => {
      // Déterminer quelle date utiliser selon le rôle du projet
      const isTechSonProject = p.techSonId && filteredUsers.some(u => u.jobRole === 'TECH_SON' && u.id === p.techSonId)
      const isRedacteurProject = p.redacteurId && filteredUsers.some(u => u.jobRole === 'REDACTEUR' && u.id === p.redacteurId)
      
      // Utiliser mixedAt pour Tech Son, writtenAt pour Rédacteur
      const projectDate = isTechSonProject ? p.mixedAt : p.writtenAt || p.createdAt
      
      if (!projectDate) return false
      
      const projectDateObj = new Date(projectDate)
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      
      // Comparer les dates (ignorer l'heure)
      return projectDateObj >= startDateObj && projectDateObj <= endDateObj
    }) || []

    console.log('📊 [PERFORMANCE API] Filtered projects:', filteredProjects.length, 'Period:', startDate, 'to', endDate)

    // ✅ Performance par membre
    const tempPerformance = filteredUsers?.map(user => {
      // ✅ CORRECTION 4: Filtrer les projets par le bon ID selon le rôle
      const userProjects = filteredProjects?.filter((p: any) => {
        if (user.jobRole === 'TECH_SON') {
          return p.techSonId === user.id
        } else {
          return p.redacteurId === user.id
        }
      }) || []
      
      // ✅ CORRECTION 5: Arrondir les minutes (entier, sans virgule)
      const totalMinutes = Math.round(userProjects.reduce((sum: number, p: any) => sum + (p.durationMin || 0), 0))
      const projectCount = userProjects.length
      
      const userObjective = getObjectiveForRole(user.jobRole, daysInPeriod)
      const ecart = totalMinutes - userObjective
      const moyenneJour = daysInPeriod > 0 ? Math.round(totalMinutes / daysInPeriod) : 0

      return {
        userId: user.id,
        name: user.name,
        jobRole: user.jobRole,
        projectCount,
        totalMinutes,
        objectif: userObjective,
        objectifJournalier: getDailyObjectiveForRole(user.jobRole),
        ecart,
        moyenneJour,
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

    // ✅ CORRECTION 6: Vue détaillée par jour - filtrer par mixedAt/writtenAt
    const daysInPeriodArray: Array<{ date: string; label: string }> = []
    const currentDate = new Date(startDate)
    while (currentDate <= new Date(endDate)) {
      daysInPeriodArray.push({
        date: currentDate.toISOString().split('T')[0],
        label: currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const dailyPerformance = daysInPeriodArray.map(day => {
      // ✅ Filtrer les projets par la date DU JOUR (mixedAt pour Tech Son, writtenAt pour Rédacteur)
      const dayProjects = filteredProjects?.filter((p: any) => {
        const isTechSonProject = p.techSonId && filteredUsers.some(u => u.jobRole === 'TECH_SON')
        const projectDate = isTechSonProject ? p.mixedAt?.split('T')[0] : p.writtenAt?.split('T')[0]
        return projectDate === day.date
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

    const myStats = finalMemberId && includeTeam 
      ? performanceByMember.find((m: any) => m.userId === finalMemberId) 
      : null

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
      myStats
    })
  } catch (e: any) {
    console.error('❌ Performance API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}