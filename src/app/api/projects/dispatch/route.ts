// src/app/api/projects/dispatch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: Récupérer les projets + rédacteurs
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // ✅ Récupérer les projets en DISPATCH
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('Project')
      .select(`
        *,
        User:redacteurId (id, name)
      `)
      .in('workflowStep', ['DISPATCH'])
      .order('deadline', { ascending: true })

    if (projectsError) {
      console.error('❌ Projects error:', projectsError)
      throw projectsError
    }

    // ✅ Récupérer les rédacteurs
    const { data: redacteurs, error: usersError } = await supabaseAdmin
      .from('User')
      .select('id, name, email, jobRole')
      .eq('role', 'MEMBER')
      .eq('jobRole', 'REDACTEUR')
      .eq('isActive', true)

    if (usersError) {
      console.error('❌ Users error:', usersError)
      throw usersError
    }

    return NextResponse.json({ 
      projects: projects || [], 
      redacteurs: redacteurs || [] 
    })
  } catch (e: any) {
    console.error('❌ [DISPATCH API] GET error:', e)
    return NextResponse.json({ error: e.message || 'Erreur de chargement' }, { status: 500 })
  }
}

// POST: Créer un nouveau projet
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { 
      name, seriesName, season, episodeNumber, broadcastChannel, 
      projectCode, deadline, startDate, durationMin, comment, redacteurId 
    } = body

    // Validation des champs requis
    if (!name || !seriesName || !deadline) {
      return NextResponse.json(
        { error: 'Champs requis: name, seriesName, deadline' }, 
        { status: 400 }
      )
    }

    // ✅ Vérifier les doublons par name
    if (name) {
      const { data: existingProject, error: checkError } = await supabaseAdmin
        .from('Project')
        .select('id, name')
        .eq('name', name)
        .maybeSingle()

      if (checkError) {
        console.error('❌ Check name error:', checkError)
        throw checkError
      }
      
      if (existingProject) {
        return NextResponse.json(
          { error: `Un projet avec ce nom existe déjà (ID: ${existingProject.id})` }, 
          { status: 409 }
        )
      }
    }

    // ✅ Vérifier les doublons par projectCode
    if (projectCode) {
      const { data: existingProject, error: checkError } = await supabaseAdmin
        .from('Project')
        .select('id, projectCode')
        .eq('projectCode', projectCode)
        .maybeSingle()

      if (checkError) {
        console.error('❌ Check code error:', checkError)
        throw checkError
      }
      
      if (existingProject) {
        return NextResponse.json(
          { error: `Un projet avec ce code existe déjà (ID: ${existingProject.id})` }, 
          { status: 409 }
        )
      }
    }

    // ✅ Insertion du projet
    const { data: project, error } = await supabaseAdmin
      .from('Project')
      .insert({
        name,
        seriesName,
        season: season || null,
        episodeNumber: episodeNumber || null,
        broadcastChannel: broadcastChannel || null,
        projectCode: projectCode || null,
        deadline,
        startDate: startDate || null,
        durationMin: durationMin || null,
        comment: comment || null,
        redacteurId: redacteurId || null,
        status: 'PAS_ENCORE',
        workflowStep: redacteurId ? 'REDACTION' : 'DISPATCH',
        language: 'fr',
        totalEpisodes: 0
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Insert error:', error)
      throw error
    }

    console.log('✅ [DISPATCH API] Project created:', project?.id)
    return NextResponse.json(project, { status: 201 })
  } catch (e: any) {
    console.error('❌ [DISPATCH API] POST error:', e)
    return NextResponse.json(
      { error: e.message || 'Erreur lors de la création du projet' }, 
      { status: 500 }
    )
  }
}

// PUT: Modifier un projet
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { id, name, projectCode, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // ✅ Vérifier les doublons par name
    if (name) {
      const { data: existingProject, error: checkError } = await supabaseAdmin
        .from('Project')
        .select('id')
        .eq('name', name)
        .neq('id', id)
        .maybeSingle()

      if (checkError) throw checkError
      if (existingProject) {
        return NextResponse.json(
          { error: `Un autre projet avec ce nom existe déjà` }, 
          { status: 409 }
        )
      }
    }

    // ✅ Vérifier les doublons par projectCode
    if (projectCode) {
      const { data: existingProject, error: checkError } = await supabaseAdmin
        .from('Project')
        .select('id')
        .eq('projectCode', projectCode)
        .neq('id', id)
        .maybeSingle()

      if (checkError) throw checkError
      if (existingProject) {
        return NextResponse.json(
          { error: `Un autre projet avec ce code existe déjà` }, 
          { status: 409 }
        )
      }
    }

    const { error } = await supabaseAdmin
      .from('Project')
      .update({
        ...updates,
        season: updates.season || null,
        episodeNumber: updates.episodeNumber || null,
        broadcastChannel: updates.broadcastChannel || null,
        projectCode: updates.projectCode || null,
        startDate: updates.startDate || null,
        durationMin: updates.durationMin || null,
        comment: updates.comment || null
      })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ [DISPATCH API] PUT error:', e)
    return NextResponse.json({ error: e.message || 'Erreur modification' }, { status: 500 })
  }
}

// PATCH: Assigner rédacteur ou mettre à jour durée
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectIds, redacteurId, durationMin } = body

    if (!projectIds || !Array.isArray(projectIds)) {
      return NextResponse.json({ error: 'projectIds requis' }, { status: 400 })
    }

    const updateData: any = {}
    
    if (durationMin !== undefined) {
      updateData.durationMin = durationMin
    }
    
    if (redacteurId !== undefined) {
      updateData.redacteurId = redacteurId
      if (redacteurId) {
        updateData.workflowStep = 'REDACTION'
      }
    }

    const { error } = await supabaseAdmin
      .from('Project')
      .update(updateData)
      .in('id', projectIds)

    if (error) throw error

    return NextResponse.json({ success: true, updated: projectIds.length })
  } catch (e: any) {
    console.error('❌ [DISPATCH API] PATCH error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE: Supprimer
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { projectIds } = body

    if (!projectIds || !Array.isArray(projectIds)) {
      return NextResponse.json({ error: 'projectIds requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('Project')
      .delete()
      .in('id', projectIds)

    if (error) throw error

    return NextResponse.json({ success: true, deleted: projectIds.length })
  } catch (e: any) {
    console.error('❌ [DISPATCH API] DELETE error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}