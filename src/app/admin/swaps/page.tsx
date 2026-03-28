'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Repeat, Check, X, Clock, Users } from 'lucide-react'
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

export default function AdminSwapsPage() {
  const { data, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (!isAdmin && !isDemo) router.push('/dashboard')
  }, [status, router, isDemo, isAdmin])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/swap-request?type=admin`)
    if (res.ok) {
      const data = await res.json()
      setRequests(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleValidate = async (id: string, approved: boolean) => {
    try {
      const res = await fetch(`/api/swap-request/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminStatus: approved ? 'ADMIN_APPROVED' : 'REJECTED',
          adminNote: adminNote[id] || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(approved ? 'Échange validé' : 'Échange refusé')
      setAdminNote(prev => ({ ...prev, [id]: '' }))
      fetchRequests()
    } catch {
      toast.error('Erreur lors de la validation')
    }
  }

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
            Validation des Échanges
          </h1>
          <p className="text-muted-foreground">Approuvez ou refusez les demandes de swap</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : requests.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune demande en attente de validation
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id} className="border-2 border-indigo-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-indigo-500" />
                      Demande d'échange
                    </CardTitle>
                    <Badge className={req.targetresponse === 'ACCEPTED' ? 'bg-blue-100 text-blue-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                      {req.targetresponse === 'ACCEPTED' ? '✅ Accepté par les membres' : '❌ Refusé par un membre'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <p className="font-medium text-indigo-700">Demandeur</p>
                      </div>
                      <p className="text-sm">{req.requester?.name || 'Membre'}</p>
                      <p className="text-xs text-muted-foreground">{req.requester?.email}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <p className="font-medium text-purple-700">Avec</p>
                      </div>
                      <p className="text-sm">{req.target?.name || 'Membre'}</p>
                      <p className="text-xs text-muted-foreground">{req.target?.email}</p>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Semaine concernée</p>
                    <p className="font-medium">{formatWeekRange(req.weekstart, req.weekend)}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Note (optionnel)</Label>
                    <Textarea 
                      placeholder="Motif de refus ou commentaire..." 
                      value={adminNote[req.id] || ''}
                      onChange={(e) => setAdminNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                    />
                  </div>

                  {req.targetresponse === 'ACCEPTED' && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700" 
                        onClick={() => handleValidate(req.id, true)}
                      >
                        <Check className="w-4 h-4 mr-2" />Valider l'échange
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50" 
                        onClick={() => handleValidate(req.id, false)}
                      >
                        <X className="w-4 h-4 mr-2" />Refuser
                      </Button>
                    </div>
                  )}

                  {req.targetresponse === 'REJECTED' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                      ❌ Cette demande a été refusée par l'un des membres.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}