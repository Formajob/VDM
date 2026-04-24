// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: Récupérer les conversations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error

    const userConversations: any[] = []
    
    for (const conv of conversations || []) {
      const { data: participants, error: partError } = await supabaseAdmin
        .from('participants')
        .select('user_id')
        .eq('conversation_id', conv.id)
      
      if (partError) continue
      
      const isParticipant = participants?.some((p: any) => p.user_id === userId)
      if (!isParticipant) continue

      const { data: messages, error: msgError } = await supabaseAdmin
        .from('messages')
        .select('id, content, sender_id, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const otherUserId = participants?.find((p: any) => p.user_id !== userId)?.user_id
      
      let otherUser: any = null
      if (otherUserId) {
        const { data: users, error: userError } = await supabaseAdmin
          .from('User')
          .select('id, name, email, jobRole')
          .eq('id', otherUserId)
          .single()
        otherUser = users
      }

      userConversations.push({
        id: conv.id,
        otherUser,
        lastMessage: messages?.[0] || null,
        updated_at: conv.updated_at
      })
    }

    return NextResponse.json({ conversations: userConversations })
  } catch (e: any) {
    console.error('❌ [MESSAGES API] GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Créer une conversation ou envoyer un message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const { receiverId, content, conversationId } = body
    const senderId = (session.user as any).id

    let convId = conversationId

    if (!convId && receiverId) {
      const { data: conversations, error: checkError } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('type', 'private')

      if (checkError) throw checkError

      let conversationExists = false
      for (const conv of conversations || []) {
        const { data: participants, error: partError } = await supabaseAdmin
          .from('participants')
          .select('user_id')
          .eq('conversation_id', conv.id)
        
        if (partError) continue
        
        const participantIds = participants?.map((p: any) => p.user_id) || []
        
        if (participantIds.includes(senderId) && participantIds.includes(receiverId)) {
          convId = conv.id
          conversationExists = true
          break
        }
      }

      if (!conversationExists) {
        const { data: newConv, error: convError } = await supabaseAdmin
          .from('conversations')
          .insert({
            type: 'private',
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (convError) throw convError
        convId = newConv?.id

        const { error: partError } = await supabaseAdmin.from('participants').insert([
          { conversation_id: convId, user_id: senderId },
          { conversation_id: convId, user_id: receiverId }
        ])

        if (partError) throw partError
      }
    }

    const { data: message, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: senderId,
        content
      })
      .select()
      .single()

    if (msgError) throw msgError

    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)

    return NextResponse.json({ 
      message, 
      conversationId: convId 
    }, { status: 201 })
  } catch (e: any) {
    console.error('❌ [MESSAGES API] POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}