'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, X, Send, Users, Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase-client'  // ✅ Singleton

interface Member {
  id: string
  name: string
  email: string
  jobRole: string
}

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  sender?: {
    id: string
    email: string
    name?: string
    jobRole?: string
  }
}

export default function ChatWidget() {
  const {  data:session } = useSession()
  const supabase = getSupabaseClient()  // ✅ Utilise le singleton

  const [isOpen, setIsOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const user = session?.user as any

  // Charger les membres
  useEffect(() => {
    if (!isOpen || !user) return

    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/users?role=MEMBER&includeInactive=false')
        const usersList = await res.json()
        setMembers(usersList.filter((u: any) => u.id !== user.id))
      } catch (e) {
        console.error('Erreur chargement membres:', e)
      }
    }

    fetchMembers()
  }, [isOpen, user])

  // Charger les conversations non lues
  useEffect(() => {
    if (!isOpen || !user) return

    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages')
        const data = await res.json()
        const unread = data.conversations?.filter(
          (c: any) => c.lastMessage?.sender_id !== user.id
        ).length || 0
        setUnreadCount(unread)
      } catch (e) {
        console.error('Erreur chargement unread:', e)
      }
    }

    fetchUnread()
  }, [isOpen, user])

  // Scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime messages
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  // Ouvrir conversation avec un membre
  const openConversation = async (member: Member) => {
    try {
      const res = await fetch('/api/messages')
      const data = await res.json()
      
      const existingConv = data.conversations?.find(
        (c: any) => c.otherUser?.id === member.id
      )

      if (existingConv) {
        setConversationId(existingConv.id)
        await fetchMessages(existingConv.id)
      } else {
        setConversationId(null)
        setMessages([])
      }

      setSelectedMember(member)
      setShowMembers(false)
    } catch (e) {
      console.error('Erreur ouverture conversation:', e)
    }
  }

// Charger les messages
const fetchMessages = async (convId: string) => {
  try {
    const res = await fetch(`/api/messages/${convId}`)
    const data = await res.json()
    const messagesList = data.messages || []
    
    // ✅ Récupérer les infos des expéditeurs depuis la table User
    if (messagesList.length > 0) {
      const senderIds = [...new Set(messagesList.map((m: any) => m.sender_id))]
      const usersRes = await fetch('/api/users')
      const usersList = await usersRes.json()
      
      // Fusionner les données
      const enrichedMessages = messagesList.map((msg: any) => ({
        ...msg,
        sender: usersList.find((u: any) => u.id === msg.sender_id)
      }))
      
      setMessages(enrichedMessages)
    } else {
      setMessages(messagesList)
    }
  } catch (e) {
    console.error('Erreur chargement messages:', e)
  }
}

  // Envoyer message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedMember) return

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedMember.id,
          content: newMessage,
          conversationId
        }),
      })

      const data = await res.json()
      
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }

      setNewMessage('')
      await fetchMessages(conversationId || data.conversationId)
    } catch (e) {
      console.error('Erreur envoi message:', e)
    }
  }

  // Retour à la liste des membres
  const backToMembers = () => {
    setSelectedMember(null)
    setConversationId(null)
    setMessages([])
    setShowMembers(true)
  }

  const filteredMembers = members.filter(m =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      {/* 🟢 BOUTON FLOTTANT */}
      <div className="fixed bottom-6 right-6 z-50">
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            {unreadCount}
          </div>
        )}
        
        <button
          onClick={() => {
            setIsOpen(!isOpen)
            if (!isOpen) setShowMembers(true)
          }}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            isOpen 
              ? 'bg-slate-600 hover:bg-slate-700 rotate-90' 
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-110'
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <MessageSquare className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* 💬 FENÊTRE DE CHAT */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[600px]">
          
          {/* Header */}
          <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedMember ? (
                <>
                  <button onClick={backToMembers} className="hover:bg-indigo-500 rounded p-1">
                    <Users className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="font-semibold">{selectedMember.name}</h3>
                    <p className="text-xs text-indigo-200">{selectedMember.jobRole}</p>
                  </div>
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  <div>
                    <h3 className="font-semibold">Messages</h3>
                    <p className="text-xs text-indigo-200">{members.length} membres</p>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 rounded p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-auto">
            {showMembers || !selectedMember ? (
              /* 📋 Liste des membres */
              <div>
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Rechercher un membre..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => openConversation(member)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.jobRole}</p>
                      </div>
                    </button>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      Aucun membre trouvé
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 💬 Conversation */
              <div className="p-4 space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none'
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
                {messages.length === 0 && (
                  <div className="text-center text-slate-400 text-sm py-8">
                    Aucun message - Commencez la conversation !
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          {selectedMember && (
            <div className="p-3 border-t border-slate-200">
              <div className="flex gap-2">
                <Input
                  placeholder="Tapez votre message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  className="flex-1 h-10"
                />
                <Button 
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}