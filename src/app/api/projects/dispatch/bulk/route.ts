
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const { projects } = await req.json()
    if (!projects?.length) return NextResponse.json({ error: 'Aucun projet' }, { status: 400 })

    const rows = projects.map((p: any) => ({
      // ✅ ID = nom brut du fichier (pour suivi client)
      id: p.rawName || p.name || `${p.seriesName}_${p.deadline}`,
      name: p.rawName || p.name || `${p.seriesName}_${p.deadline}`,
      seriesName: p.seriesName || '',
      season: p.season || null,
      episodeNumber: p.episodeNumber || null,
      broadcastChannel: p.broadcastChannel || null,
      projectCode: p.projectCode || null,
      deadline: p.deadline,
      startDate: p.startDate || null,
      durationMin: p.durationMin !== undefined ? parseFloat(p.durationMin) : null,
      pageCount: null,
      comment: p.comment || null,
      // ✅ TOUS commencent en DISPATCH (même avec redacteurId)
      workflowStep: 'DISPATCH',
      // ✅ Stocker redacteurId mais ne pas changer workflowStep
      redacteurId: (p.redacteurId && p.redacteurId !== 'none') ? p.redacteurId : null,
      status: 'PAS_ENCORE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    const { data, error } = await supabaseAdmin
      .from('Project')
      .insert(rows)
      .select('id, name, workflowStep')

    if (error) {
      console.error('❌ Bulk insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      ids: data?.map((d: any) => d.id) || []
    })
  } catch (e: any) {
    console.error('❌ Bulk exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}