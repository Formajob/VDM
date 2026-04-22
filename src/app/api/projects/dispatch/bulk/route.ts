// src/app/api/projects/dispatch/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projects } = body

    if (!projects || !Array.isArray(projects)) {
      return NextResponse.json({ error: 'projects array requis' }, { status: 400 })
    }

    const validProjects = projects.filter((p: any) => p.valid)
    
    const existingNames = new Set<string>()
    const existingCodes = new Set<string>()
    
    const namesToCheck = validProjects.map((p: any) => p.rawName || p.seriesName).filter(Boolean)
    const codesToCheck = validProjects.map((p: any) => p.projectCode).filter(Boolean)
    
    if (namesToCheck.length > 0) {
      // ✅ CORRECTION: Utiliser { data, error }
      const { data, error } = await supabaseAdmin
        .from('Project')
        .select('name, projectCode')
        .in('name', namesToCheck)
      
      if (!error && data) {
        data.forEach((p: any) => {
          if (p.name) existingNames.add(p.name)
          if (p.projectCode) existingCodes.add(p.projectCode)
        })
      }
    }

    const projectsToInsert = validProjects
      .filter((p: any) => {
        const name = p.rawName || p.seriesName
        const code = p.projectCode
        return !existingNames.has(name) && (!code || !existingCodes.has(code))
      })
      .map((p: any) => ({
        name: p.rawName || p.seriesName,
        seriesName: p.seriesName,
        season: p.season || null,
        episodeNumber: p.episodeNumber || null,
        broadcastChannel: p.broadcastChannel || null,
        projectCode: p.projectCode || null,
        deadline: p.deadline,
        startDate: null,
        durationMin: p.durationMin || null,
        comment: p.comment || null,
        redacteurId: p.redacteurId || null,
        status: 'PAS_ENCORE',
        workflowStep: p.redacteurId ? 'REDACTION' : 'DISPATCH',
        language: 'fr',
        totalEpisodes: 0
      }))

    if (projectsToInsert.length === 0) {
      return NextResponse.json({ 
        count: 0, 
        message: 'Aucun nouveau projet à importer',
        skipped: validProjects.length 
      })
    }

    // ✅ CORRECTION: Utiliser { data, error }
    const { data, error } = await supabaseAdmin
      .from('Project')
      .insert(projectsToInsert)
      .select()

    if (error) {
      console.error('❌ Bulk insert error:', error)
      throw error
    }

    console.log('✅ [DISPATCH BULK] Inserted:', data?.length, 'projects')

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      skipped: validProjects.length - (data?.length || 0),
      projects: data 
    })
  } catch (e: any) {
    console.error('❌ [DISPATCH BULK] Error:', e)
    return NextResponse.json({ error: e.message || 'Erreur import' }, { status: 500 })
  }
}