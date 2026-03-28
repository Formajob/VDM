'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Repeat, Check, X, Clock, ArrowRight, ArrowLeft } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface SwapRequest {
  id: string
  requesterid: string
  targetuserid: string
  weekstart: string
  weekend: string
  status: string
  targetresponse: string | null
  adminnote: string | null
  createdat: string
  requester: { name: string; email: string }
  target: { name: string; email: string }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekEnd + 'T00:00:00')
  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}

export default function SwapRequestsPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null

  const [incomingRequests, setIncomingRequests] = useState<SwapRequest[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming')

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    
    const incomingRes = await fetch(`/api/swap-request?type=incoming`)
    if (incomingRes.ok) {
      const data = await incomingRes.json()
      setIncomingRequests(data)
    }
    
    const outgoingRes = await fetch(`/api/swap-request?type=outgoing`)
    if (outgoingRes.ok) {
      const data = await outgoingRes.json()
      setOutgoingRequests(data)
    }
    
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleResponse = async (id: string, response: 'ACCEPTED' | 'REJECTED') => {
  console.log('🔹 Handling response:', { id, response })
  
  try {
    const res = await fetch(`/api/swap-request/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetResponse: response }),
    })
    
    console.log('🔹 API response status:', res.status)
    
    if (!res.ok) {
      const errorData = await res.json()
      console.error('❌ API error:', errorData)
      throw new Error()
    }
    
    toast.success(response === 'ACCEPTED' ? 'Demande acceptée' : 'Demande refusée')
    fetchRequests()
  } catch (error) {
    console.error('❌ Error:', error)
    toast.error('Erreur lors de la réponse')
  }
}

  const getStatusBadge = (req: SwapRequest, isOutgoing: boolean) => {
    if (req.status === 'ADMIN_APPROVED') {
      return <Badge className="bg-emerald-100 text-emerald-700 border-0"><Check className="w-3 h-3 mr-1" />Validé par l'admin</Badge>
    }
    
    if (req.status === 'REJECTED') {
      return <Badge className="bg-red-100 text-red-700 border-0"><X className="w-3 h-3 mr-1" />Refusé</Badge>
    }
    
    if (isOutgoing) {
      if (req.targetresponse === 'ACCEPTED') {
        return <Badge className="bg-blue-100 text-blue-700 border-0"><Clock className="w-3 h-3 mr-1" />En attente admin</Badge>
      }
      if (req.targetresponse === 'REJECTED') {
        return <Badge className="bg-red-100 text-red-700 border-0"><X className="w-3 h-3 mr-1" />Refusé par {req.target?.name}</Badge>
      }
      return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="w-3 h-3 mr-1" />En attente de {req.target?.name}</Badge>
    } else {
      if (req.status === 'TARGET_ACCEPTED') {
        return <Badge className="bg-blue-100 text-blue-700 border-0"><Clock className="w-3 h-3 mr-1" />En attente validation admin</Badge>
      }
      if (req.targetresponse === 'ACCEPTED') {
        return <Badge className="bg-emerald-100 text-emerald-700 border-0"><Check className="w-3 h-3 mr-1" />Vous avez accepté</Badge>
      }
      if (req.targetresponse === 'REJECTED') {
        return <Badge className="bg-red-100 text-red-700 border-0"><X className="w-3 h-3 mr-1" />Vous avez refusé</Badge>
      }
      return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="w-3 h-3 mr-1" />À répondre</Badge>
    }
  }

  const RequestCard = ({ req, isOutgoing }: { req: SwapRequest; isOutgoing: boolean }) => (
    <Card key={req.id} className="border-2 border-indigo-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Repeat className="w-4 h-4 text-indigo-500" />
            {isOutgoing ? (
              <>
                <span>Échange avec</span>
                <span className="font-semibold">{req.target?.name || 'Membre'}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Votre planning ↔ {req.target?.name}</span>
              </>
            ) : (
              <>
                <span>Échange avec</span>
                <span className="font-semibold">{req.requester?.name || 'Membre'}</span>
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{req.requester?.name} ↔ Votre planning</span>
              </>
            )}
          </CardTitle>
          {getStatusBadge(req, isOutgoing)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Semaine</p>
            <p className="font-medium">{formatWeekRange(req.weekstart, req.weekend)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{isOutgoing ? 'Demandé le' : 'Reçu le'}</p>
            <p className="font-medium">{new Date(req.createdat).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Workflow status timeline */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-emerald-600">
            <div className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Demande créée</span>
          </div>
          <div className="w-4 h-px bg-slate-300" />
          <div className={`flex items-center gap-1 ${req.targetresponse ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            <div className={`w-2 h-2 rounded-full ${req.targetresponse ? 'bg-emerald-600' : 'bg-slate-300'}`} />
            <span>Réponse {isOutgoing ? req.target?.name : 'votre'}</span>
          </div>
          <div className="w-4 h-px bg-slate-300" />
          <div className={`flex items-center gap-1 ${req.status === 'ADMIN_APPROVED' || req.status === 'REJECTED' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            <div className={`w-2 h-2 rounded-full ${req.status === 'ADMIN_APPROVED' || req.status === 'REJECTED' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
            <span>Validation admin</span>
          </div>
        </div>

        {isOutgoing && req.status === 'PENDING' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
            ⏳ En attente de la réponse de {req.target?.name}
          </div>
        )}

        {isOutgoing && req.targetresponse === 'ACCEPTED' && req.status === 'TARGET_ACCEPTED' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
            ✅ {req.target?.name} a accepté. En attente de validation par l'administration.
          </div>
        )}

        {isOutgoing && req.targetresponse === 'REJECTED' && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            ❌ {req.target?.name} a refusé cette demande.
            {req.adminnote && <p className="mt-1">Motif : {req.adminnote}</p>}
          </div>
        )}

        {!isOutgoing && req.status === 'PENDING' && (
          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700" 
              onClick={() => handleResponse(req.id, 'ACCEPTED')}
            >
              <Check className="w-4 h-4 mr-2" />Accepter
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50" 
              onClick={() => handleResponse(req.id, 'REJECTED')}
            >
              <X className="w-4 h-4 mr-2" />Refuser
            </Button>
          </div>
        )}

        {req.status === 'ADMIN_APPROVED' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
            ✅ L'échange a été validé par l'administration. Vos plannings ont été échangés.
          </div>
        )}

        {req.status === 'REJECTED' && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            ❌ Cette demande a été refusée.
            {req.adminnote && <p className="mt-1">Motif : {req.adminnote}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (status === 'loading' && !isDemo) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Demandes d'Échange
          </h1>
          <p className="text-muted-foreground">Gérez les demandes de swap de planning</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100">
            <TabsTrigger value="incoming" className="data-[state=active]:bg-white">
              Reçues ({incomingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="data-[state=active]:bg-white">
              Envoyées ({outgoingRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : incomingRequests.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune demande reçue
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((req) => (
                  <RequestCard key={req.id} req={req} isOutgoing={false} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="outgoing" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : outgoingRequests.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune demande envoyée
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {outgoingRequests.map((req) => (
                  <RequestCard key={req.id} req={req} isOutgoing={true} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}