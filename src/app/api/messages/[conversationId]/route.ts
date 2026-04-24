// src/app/api/messages/[conversationId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: Récupérer les messages d'une conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    
    const { conversationId } = await params
    
    if (!conversationId || conversationId === 'undefined') {
      return NextResponse.json({ error: 'Conversation ID requis' }, { status: 400 })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // ✅ SYNTAXE EXPLICITE: { data: messages, error }
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', conversationId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ messages: messages || [] })
  } catch (e: any) {
    console.error('❌ [MESSAGES API] GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: Mettre à jour la conversation
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { conversationId } = await params
    
    if (!conversationId || conversationId === 'undefined') {
      return NextResponse.json({ error: 'Conversation ID requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ [MESSAGES API] PATCH error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}