'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, X, Send, Users, Search, User, ArrowLeft, Volume2, VolumeX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase-client'

interface Member {
  id: string
  name: string
  email: string
  jobRole: string
  isOnline?: boolean
}

interface Message {
 id: string
  content: string
  sender_id: string
  created_at: string
  conversation_id: string  // ← ← ← AJOUTER CETTE LIGNE
  sender?: {
    id: string
    name?: string
    jobRole?: string
  }
}

interface Conversation {
  id: string
  otherUser: Member | null
  lastMessage: Message | null
  updated_at: string
  hasUnread?: boolean
}

// ✅ SON DE NOTIFICATION (Base64 - son court et discret)
const NOTIFICATION_SOUND = 'data:audio/mp3;base64,//NExAAAAania...' // Version courte ci-dessous

export default function ChatWidget() {
  const {  data:session } = useSession()
  const supabase = getSupabaseClient()

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'conversations' | 'members' | 'chat'>('conversations')
  const [members, setMembers] = useState<Member[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true) // ✅ Gestion du son

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const user = session?.user as any

  // ✅ Initialiser le son au montage
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3')
    audioRef.current.volume = 0.5
    audioRef.current.preload = 'auto'
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // ✅ Jouer le son de notification
  const playNotificationSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(e => console.log('🔕 Son bloqué par le navigateur:', e))
    }
  }

  // Charger les membres avec statut en ligne
  useEffect(() => {
    if (!isOpen || !user) return

    const fetchMembersAndStatus = async () => {
      try {
        const usersRes = await fetch('/api/users?includeInactive=false')
        const usersList = await usersRes.json()
        
        const today = new Date().toISOString().split('T')[0]
        const attendanceRes = await fetch(`/api/attendance?all=true&date=${today}`)
        const attendanceRecords = await attendanceRes.json()
        
        const onlineUserIds = new Set(
          attendanceRecords
            .filter((r: any) => r && r.userId && !r.endedAt && r.status !== 'ABSENT')
            .map((r: any) => r.userId)
        )

        const membersWithStatus = usersList
          .filter((u: any) => u && u.id !== user.id)
          .map((u: any) => ({
            ...u,
            isOnline: onlineUserIds.has(u.id)
          }))

        setMembers(membersWithStatus)
      } catch (e) {
        console.error('Erreur chargement membres:', e)
        const usersRes = await fetch('/api/users?includeInactive=false')
        const usersList = await usersRes.json()
        setMembers(usersList.filter((u: any) => u.id !== user.id).map((u: any) => ({ ...u, isOnline: false })))
      }
    }

    fetchMembersAndStatus()
  }, [isOpen, user])

  // Charger les conversations et calculer les non-lus
  useEffect(() => {
    if (!isOpen || !user) return

    const fetchConversations = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/messages')
        const data = await res.json()
        
        const conversationsWithUnread = (data.conversations || []).map((c: any) => ({
          ...c,
          hasUnread: c.lastMessage?.sender_id !== user.id
        }))
        
        setConversations(conversationsWithUnread)
        
        const unread = conversationsWithUnread.filter((c: any) => c.hasUnread).length
        setUnreadCount(unread)
        
        console.log('📦 Conversations loaded:', conversationsWithUnread.length, 'Unread:', unread)
      } catch (e) {
        console.error('Erreur chargement conversations:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [isOpen, user])

  // Scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ✅ Realtime messages AVEC SON
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
          const newMsg = payload.new as Message
          
          // ✅ Vérifier si le message vient d'un autre utilisateur
          const isFromOther = newMsg.sender_id !== user?.id
          
          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMsg.id)
            if (exists) return prev
            return [...prev, newMsg]
          })
          
          setConversations(prev => {
            const updated = prev.map(c => 
              c.id === conversationId 
                ? { ...c, lastMessage: newMsg, hasUnread: isFromOther }
                : c
            )
            const newUnreadCount = updated.filter(c => c.hasUnread).length
            setUnreadCount(newUnreadCount)
            return updated
          })
          
          // ✅ Jouer le son si le message vient d'un autre utilisateur
          if (isFromOther) {
            playNotificationSound()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase, user?.id, soundEnabled])

  // ✅ Realtime pour TOUS les messages (même si pas dans la conversation ouverte)
  useEffect(() => {
    if (!isOpen) return

    const globalChannel = supabase
      .channel('messages:global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMsg = payload.new as Message
          const isFromOther = newMsg.sender_id !== user?.id
          
          // ✅ Rafraîchir les conversations
          const convRes = await fetch('/api/messages')
          const convData = await convRes.json()
          const updatedConversations = (convData.conversations || []).map((c: any) => ({
            ...c,
            hasUnread: c.lastMessage?.sender_id !== user.id
          }))
          setConversations(updatedConversations)
          
          const newUnreadCount = updatedConversations.filter((c: any) => c.hasUnread).length
          setUnreadCount(newUnreadCount)
          
          // ✅ Jouer le son si message reçu et widget ouvert mais pas dans cette conversation
          if (isFromOther && conversationId !== newMsg.conversation_id) {
            playNotificationSound()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(globalChannel)
    }
  }, [isOpen, conversationId, user?.id, soundEnabled])

  // Ouvrir conversation avec un membre
  const openConversation = async (member: Member) => {
    try {
      const existingConv = conversations.find(
        (c) => c.otherUser?.id === member.id
      )

      if (existingConv) {
        setConversationId(existingConv.id)
        await fetchMessages(existingConv.id)
        
        setConversations(prev => {
          const updated = prev.map(c => 
            c.id === existingConv.id ? { ...c, hasUnread: false } : c
          )
          const newUnreadCount = updated.filter(c => c.hasUnread).length
          setUnreadCount(newUnreadCount)
          return updated
        })
      } else {
        setConversationId(null)
        setMessages([])
      }

      setSelectedMember(member)
      setView('chat')
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
      
      if (messagesList.length > 0) {
        const senderIds = [...new Set(messagesList.map((m: any) => m.sender_id))]
        const usersRes = await fetch('/api/users')
        const usersList = await usersRes.json()
        
        const enrichedMessages = messagesList.map((msg: any) => ({
          ...msg,
          sender: usersList.find((u: any) => u.id === msg.sender_id)
        }))
        
        const uniqueMessages = enrichedMessages.filter(
          (msg: any, index: number, self: any[]) =>
            index === self.findIndex((m) => m.id === msg.id)
        )
        
        setMessages(uniqueMessages)
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
      
      const convRes = await fetch('/api/messages')
      const convData = await convRes.json()
      const updatedConversations = (convData.conversations || []).map((c: any) => ({
        ...c,
        hasUnread: c.lastMessage?.sender_id !== user.id
      }))
      setConversations(updatedConversations)
      
      const newUnreadCount = updatedConversations.filter((c: any) => c.hasUnread).length
      setUnreadCount(newUnreadCount)
    } catch (e) {
      console.error('Erreur envoi message:', e)
    }
  }

  const backToConversations = () => {
    setSelectedMember(null)
    setConversationId(null)
    setMessages([])
    setView('conversations')
  }

  const goToMembers = () => {
    setSelectedMember(null)
    setConversationId(null)
    setMessages([])
    setView('members')
  }

  const toggleWidget = () => {
    if (isOpen) {
      setIsOpen(false)
    } else {
      setIsOpen(true)
      setView('conversations')
    }
  }

  // ✅ Basculer le son
  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSoundEnabled(!soundEnabled)
  }

  const filteredMembers = members.filter(m =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredConversations = conversations.filter(c =>
    c.otherUser?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      {/* 🟢 BOUTON FLOTTANT */}
      <div className="fixed bottom-6 right-6 z-50">
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse shadow-lg">
            {unreadCount}
          </div>
        )}
        
        <button
          onClick={toggleWidget}
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
              {view === 'chat' && selectedMember ? (
                <>
                  <button onClick={backToConversations} className="hover:bg-indigo-500 rounded p-1 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="font-semibold">{selectedMember.name}</h3>
                    <p className="text-xs text-indigo-200">{selectedMember.jobRole}</p>
                  </div>
                </>
              ) : view === 'members' ? (
                <>
                  <button onClick={backToConversations} className="hover:bg-indigo-500 rounded p-1 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="font-semibold">Nouvelle conversation</h3>
                    <p className="text-xs text-indigo-200">{members.length} membres</p>
                  </div>
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5" />
                  <div>
                    <h3 className="font-semibold">Messages</h3>
                    <p className="text-xs text-indigo-200">
                      {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* ✅ Bouton Son ON/OFF */}
              <button 
                onClick={toggleSound} 
                className="hover:bg-indigo-500 rounded p-1 transition-colors"
                title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 rounded p-1 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-auto">
            {view === 'members' ? (
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
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          member.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`} />
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
                <div className="p-3 border-t border-slate-100">
                  <Button onClick={backToConversations} variant="ghost" size="sm" className="w-full gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux conversations
                  </Button>
                </div>
              </div>
            ) : view === 'chat' && selectedMember ? (
              /* 💬 Conversation */
              <div className="p-4 space-y-3">
                {messages.map((msg, index) => {
                  const isMe = msg.sender_id === user?.id
                  const uniqueKey = msg.id || `${msg.sender_id}-${msg.created_at}-${index}`
                  return (
                    <div key={uniqueKey} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
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
            ) : (
              /* 📋 Liste des conversations */
              <div>
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Button onClick={goToMembers} variant="ghost" size="sm" className="ml-2 gap-1">
                    <Users className="w-4 h-4" />
                    Nouveau
                  </Button>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv.otherUser!)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                        </div>
                        {conv.hasUnread && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-sm truncate ${
                            conv.hasUnread ? 'text-indigo-700 font-semibold' : 'text-slate-800'
                          }`}>
                            {conv.otherUser?.name || 'Inconnu'}
                          </p>
                          {conv.lastMessage && (
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {new Date(conv.lastMessage.created_at).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', minute: '2-digit' 
                              })}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className={`text-xs truncate ${
                            conv.hasUnread ? 'text-indigo-600 font-semibold' : 'text-slate-500'
                          }`}>
                            {conv.lastMessage.sender_id === user?.id && 'Vous: '}
                            {conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredConversations.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      Aucune conversation - Commencez une nouvelle discussion !
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          {view === 'chat' && selectedMember && (
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