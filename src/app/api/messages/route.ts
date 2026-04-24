// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: Récupérer les conversations de l'utilisateur
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    
    // ✅ CORRECTION: Utiliser { data, error }
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        participants:participants(
          user_id,
          user:auth.users!participants_user_id_fkey(id, email)
        ),
        messages:messages(
          id,
          content,
          sender_id,
          created_at
        )
      `)
      .eq('participants.user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const formattedConversations = conversations?.map((conv: any) => {
      const otherParticipant = conv.participants?.find(
        (p: any) => p.user_id !== userId
      )
      const lastMessage = conv.messages?.[0]
      
      return {
        id: conv.id,
        otherUser: otherParticipant?.user,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          sender_id: lastMessage.sender_id,
          created_at: lastMessage.created_at
        } : null,
        updated_at: conv.updated_at
      }
    })

    return NextResponse.json({ conversations: formattedConversations || [] })
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
      // ✅ CORRECTION: Utiliser { data, error }
      const { data: convWithReceiver, error: checkError } = await supabaseAdmin
        .from('conversations')
        .select(`
          id,
          participants:participants(user_id)
        `)
        .eq('type', 'private')

      if (checkError) throw checkError

      const conversationExists = convWithReceiver?.find((conv: any) => {
        const participantIds = conv.participants?.map((p: any) => p.user_id) || []
        return participantIds.includes(senderId) && participantIds.includes(receiverId)
      })

      if (conversationExists) {
        convId = conversationExists.id
      } else {
        // ✅ CORRECTION: Utiliser { data, error }
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

        await supabaseAdmin.from('participants').insert([
          { conversation_id: convId, user_id: senderId },
          { conversation_id: convId, user_id: receiverId }
        ])
      }
    }

    // ✅ CORRECTION: Utiliser { data, error } - SANS jointure sender
    const { data: message, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: senderId,
        content
      })
      .select()  // ✅ Supprimer la jointure sender qui cause l'erreur
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