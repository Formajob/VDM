'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search, Send, Users, MessageSquare, MoreVertical, User
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'
import { createClient } from '@supabase/supabase-js'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  sender?: {
    id: string
    name: string
    email: string
    jobRole: string
  }
}

interface Conversation {
  id: string
  otherUser: {
    id: string
    name: string
    email: string
    jobRole: string
  } | null
  lastMessage: {
    id: string
    content: string
    sender_id: string
    created_at: string
  } | null
  updated_at: string
}

export default function MessagesPage() {
  const {  data:session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<{
    id: string
    name: string
    email: string
    jobRole: string
  } | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [users, setUsers] = useState<Array<{
    id: string
    name: string
    email: string
    jobRole: string
    role: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserList, setShowUserList] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const user: DemoUser | null = (session?.user as DemoUser) || demoUser || null

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (e) {
      console.error('Erreur chargement conversations:', e)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=MEMBER&includeInactive=false')
      if (!res.ok) throw new Error()
      const usersList = await res.json()
      setUsers(usersList || [])
    } catch (e) {
      console.error('Erreur chargement utilisateurs:', e)
    }
  }, [])

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages/${conversationId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (e) {
      console.error('Erreur chargement messages:', e)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchConversations()
      fetchUsers()
      setLoading(false)
    }
  }, [user, fetchConversations, fetchUsers])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!selectedConversation) return

    const channel = supabase
      .channel(`messages:${selectedConversation}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversation, supabase])

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedUser?.id,
          content: newMessage,
          conversationId: selectedConversation
        }),
      })

      if (!res.ok) throw new Error()
      
      const data = await res.json()
      
      if (!selectedConversation && data.conversationId) {
        setSelectedConversation(data.conversationId)
        await fetchConversations()
      }
      
      setNewMessage('')
      await fetchMessages(selectedConversation || data.conversationId)
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`)
    }
  }

  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv.id)
    setSelectedUser(conv.otherUser)
    await fetchMessages(conv.id)
    setShowUserList(false)
  }

  const startConversation = (u: { id: string; name: string; email: string; jobRole: string }) => {
    setSelectedUser(u)
    setSelectedConversation(null)
    setMessages([])
    setShowUserList(false)
  }

  const filteredConversations = conversations.filter(conv =>
    conv.otherUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    u.id !== user?.id
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex gap-4">
        
        {/* Sidebar - Liste des conversations */}
        <div className="w-80 bg-white rounded-xl border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Messages
            </h2>
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {showUserList ? (
              <div className="divide-y divide-slate-100">
                {filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.jobRole}</p>
                    </div>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    Aucun utilisateur trouvé
                  </div>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowUserList(true)}
                  className="w-full p-3 flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 transition-colors border-b border-slate-100"
                >
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Nouvelle conversation</span>
                </button>
                <div className="divide-y divide-slate-100">
                  {filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left ${
                        selectedConversation === conv.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-slate-800 truncate">
                            {conv.otherUser?.name || 'Inconnu'}
                          </p>
                          {conv.lastMessage && (
                            <span className="text-xs text-slate-400">
                              {new Date(conv.lastMessage.created_at).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className="text-xs truncate text-slate-500">
                            {conv.lastMessage.sender_id === user?.id && 'Vous: '}
                            {conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredConversations.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      Aucune conversation
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone de conversation */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col">
          {selectedUser ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{selectedUser.name}</h3>
                    <p className="text-xs text-slate-500">{selectedUser.jobRole}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id
                  const showDate = idx === 0 || 
                    new Date(msg.created_at).toDateString() !== new Date(messages[idx - 1].created_at).toDateString()
                  
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                            {new Date(msg.created_at).toLocaleDateString('fr-FR', { 
                              day: '2-digit', 
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-slate-100 text-slate-800 rounded-bl-none'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-200">
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
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Send className="w-4 h-4" />
                    Envoyer
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">Sélectionnez une conversation</p>
                <p className="text-sm mt-1">ou démarrez-en une nouvelle</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}