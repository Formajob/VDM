// src/app/api/projects/dispatch/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { parseProjectName } from '@/lib/parseProjectName'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const { projects } = await req.json()
    if (!projects?.length) return NextResponse.json({ error: 'Aucun projet' }, { status: 400 })

    console.log('📦 Bulk import:', projects.length, 'projets')

    const rows = projects.map((p: any) => {
      // ✅ Si rawName fourni, parser le nom pour extraire les infos
      const parsed = p.rawName ? parseProjectName(p.rawName) : null

      return {
        // ✅ ID = nom brut du fichier (pour suivi client)
        id: p.rawName || p.name || `${p.seriesName}_${p.deadline}`,
        name: p.rawName || p.name || `${p.seriesName}_${p.deadline}`,
        seriesName: p.seriesName || parsed?.seriesName || '',
        season: p.season || parsed?.season || null,
        episodeNumber: p.episodeNumber || parsed?.episodeNumber || null,
        broadcastChannel: p.broadcastChannel || parsed?.broadcastChannel || null,
        projectCode: p.projectCode || parsed?.projectCode || null,
        deadline: p.deadline || parsed?.deadline || null,
        startDate: p.startDate || null,
        durationMin: p.durationMin || null,
        pageCount: null,
        comment: p.comment || null,
        // ✅ TOUS commencent en DISPATCH (même avec redacteurId)
        workflowStep: 'DISPATCH',
        // ✅ Stocker redacteurId mais ne pas changer workflowStep
        redacteurId: (p.redacteurId && p.redacteurId !== 'none') ? p.redacteurId : null,
        status: 'PAS_ENCORE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

    console.log('📤 Insert rows:', rows)

    const { data, error } = await supabaseAdmin
      .from('Project')
      .insert(rows)
      .select('id, name, workflowStep')

    console.log('📥 Supabase result:', { data, error })

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      ids: data?.map((d: any) => d.id) || []
    })
  } catch (e: any) {
    console.error('❌ Exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}