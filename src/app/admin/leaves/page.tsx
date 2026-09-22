'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Check, History, Palmtree, Plus, Save, X } from 'lucide-react'

type User = { id: string; name: string; email: string; jobRole?: string; role?: string; isActive?: boolean }
type LeaveRequest = { id: string; userid: string; startdate: string; enddate: string; type: string; reason?: string; status: string; adminnote?: string }
type Balance = { userid: string; annualdays: number }

const typeLabels: Record<string, string> = { ANNUEL: 'Annuel', EXCEPTIONNEL: 'Exceptionnel', MALADIE: 'Maladie', AUTRE: 'Autre' }
const statusLabels: Record<string, string> = { PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Refusée', CANCELLED: 'Annulée' }

export default function AdminLeavesPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<Record<string, Balance>>({})
  const [selectedUser, setSelectedUser] = useState('')
  const [form, setForm] = useState({ startDate: '', endDate: '', type: 'ANNUEL', reason: '' })
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    const [usersRes, requestsRes, balancesRes] = await Promise.all([
      fetch('/api/users?includeInactive=false'), fetch('/api/leave-request'), fetch('/api/leave-balance?all=true'),
    ])
    if (!usersRes.ok || !requestsRes.ok || !balancesRes.ok) {
      const failedResponse = !usersRes.ok ? usersRes : !requestsRes.ok ? requestsRes : balancesRes
      const errorBody = await failedResponse.json().catch(() => null)
      throw new Error(errorBody?.error || `Erreur API (${failedResponse.status})`)
    }
    const [userData, requestData, balanceData] = await Promise.all([usersRes.json(), requestsRes.json(), balancesRes.json()])
    setUsers(userData)
    setRequests(requestData)
    setBalances(Object.fromEntries(balanceData.map((balance: Balance) => [balance.userid, balance])))
    setLoadError('')
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/login')
    if (session?.user && (session.user as any).role !== 'ADMIN') router.push('/dashboard')
  }, [session, sessionStatus, router])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || (session?.user as any)?.role !== 'ADMIN') return
    load().catch(error => { setLoadError(error.message); toast.error(error.message) })
  }, [sessionStatus, session])

  const updateRequest = async (request: LeaveRequest, nextStatus: string) => {
    const response = await fetch('/api/leave-request', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: request.id, status: nextStatus }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    await load()
    toast.success(nextStatus === 'APPROVED' ? 'Congé approuvé et solde déduit' : 'Demande mise à jour')
  }

  const createRequest = async () => {
    if (!selectedUser || !form.startDate || !form.endDate) return toast.error('Choisissez un membre et une période')
    setSaving(true)
    try {
      const response = await fetch('/api/leave-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedUser, ...form, status: 'APPROVED' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setForm({ startDate: '', endDate: '', type: 'ANNUEL', reason: '' }); await load(); toast.success('Congé saisi et solde déduit')
    } catch (error: any) { toast.error(error.message) } finally { setSaving(false) }
  }

  const saveBalance = async (userId: string, values: Balance) => {
    const response = await fetch('/api/leave-balance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, userId }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setBalances(current => ({ ...current, [userId]: result })); toast.success('Solde mis à jour')
  }

  if (sessionStatus === 'loading') return <DashboardLayout><div className="p-8 text-center">Chargement...</div></DashboardLayout>
  return <DashboardLayout>
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold flex items-center gap-2"><Palmtree className="text-blue-600" /> Gestion des congés</h1><p className="text-muted-foreground">Validez les demandes, consultez l’historique et gérez les soldes.</p></div>
      {loadError && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-700">Impossible de charger les données: {loadError}</CardContent></Card>}
      <Tabs defaultValue="pending">
        <TabsList><TabsTrigger value="pending">Validation ({requests.filter(request => request.status === 'PENDING').length})</TabsTrigger><TabsTrigger value="history"><History className="w-4 h-4 mr-2" />Historique</TabsTrigger><TabsTrigger value="entry"><Plus className="w-4 h-4 mr-2" />Saisie admin</TabsTrigger><TabsTrigger value="balances">Soldes</TabsTrigger></TabsList>
        <TabsContent value="pending" className="space-y-3">{requests.filter(request => request.status === 'PENDING').map(request => <RequestCard key={request.id} request={request} users={users} onAction={updateRequest} />)}{requests.every(request => request.status !== 'PENDING') && <Empty text="Aucune demande en attente" />}</TabsContent>
        <TabsContent value="history" className="space-y-3">{requests.filter(request => request.status !== 'PENDING').map(request => <RequestCard key={request.id} request={request} users={users} onAction={updateRequest} />)}{requests.every(request => request.status === 'PENDING') && <Empty text="Aucun historique" />}</TabsContent>
        <TabsContent value="entry"><Card><CardHeader><CardTitle>Saisir un congé pour un membre</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Membre</Label><Select value={selectedUser} onValueChange={setSelectedUser}><SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger><SelectContent>{users.map(user => <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Du</Label><Input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></div><div><Label>Au</Label><Input type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></div>
          <div><Label>Type</Label><Select value={form.type} onValueChange={type => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Motif</Label><Input value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} placeholder="Motif (facultatif)" /></div>
          <Button className="sm:col-span-2" onClick={createRequest} disabled={saving}><Plus className="w-4 h-4 mr-2" />{saving ? 'Enregistrement...' : 'Enregistrer le congé'}</Button>
        </CardContent></Card></TabsContent>
        <TabsContent value="balances"><BalanceTable users={users.filter(user => user.isActive !== false)} balances={balances} onSave={saveBalance} /></TabsContent>
      </Tabs>
    </div>
  </DashboardLayout>
}

function RequestCard({ request, users, onAction }: { request: LeaveRequest; users: User[]; onAction: (request: LeaveRequest, status: string) => Promise<void> }) {
  const user = users.find(item => item.id === request.userid)
  return <Card><CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{user?.name || request.userid} · {typeLabels[request.type] || request.type}</p><p className="text-sm text-muted-foreground">Du {request.startdate} au {request.enddate}{request.reason ? ` · ${request.reason}` : ''}</p><p className="text-xs mt-1">Statut: <span className="font-medium">{statusLabels[request.status] || request.status}</span></p></div>{request.status === 'PENDING' && <div className="flex gap-2"><Button size="sm" onClick={() => onAction(request, 'APPROVED')}><Check className="w-4 h-4 mr-1" />Valider</Button><Button size="sm" variant="outline" onClick={() => onAction(request, 'REJECTED')}><X className="w-4 h-4 mr-1" />Refuser</Button></div>}</CardContent></Card>
}

function BalanceTable({ users, balances, onSave }: { users: User[]; balances: Record<string, Balance>; onSave: (userId: string, balance: Balance) => Promise<void> }) {
  return <Card><CardHeader><CardTitle>Solde annuel de l’équipe</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="px-3 py-3">Nom et prénom</th><th className="px-3 py-3">Fonction</th><th className="px-3 py-3 text-right">Solde total</th><th className="px-3 py-3" /></tr></thead><tbody>{users.map(user => <BalanceEditor key={user.id} user={user} balance={balances[user.id]} onSave={onSave} />)}</tbody></table></div>{users.length === 0 && <p className="p-6 text-center text-muted-foreground">Aucun membre actif</p>}</CardContent></Card>
}

function BalanceEditor({ user, balance, onSave }: { user: User; balance?: Balance; onSave: (userId: string, balance: Balance) => Promise<void> }) {
  const [values, setValues] = useState<Balance>(balance || { userid: user.id, annualdays: 0 })
  useEffect(() => { if (balance) setValues(balance) }, [balance])
  return <tr className="border-b last:border-0"><td className="px-3 py-3"><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{user.email}</div></td><td className="px-3 py-3 text-muted-foreground">{user.jobRole || 'Non renseignée'}</td><td className="px-3 py-3 text-right"><Label className="sr-only">Solde annuel de {user.name}</Label><Input className="ml-auto w-28 text-right" type="number" min="0" step="0.5" value={values.annualdays} onChange={event => setValues({ ...values, annualdays: Number(event.target.value) })} /></td><td className="px-3 py-3 text-right"><Button size="sm" onClick={() => onSave(user.id, values)}><Save className="w-4 h-4 mr-1" />Enregistrer</Button></td></tr>
}

function Empty({ text }: { text: string }) { return <Card><CardContent className="p-8 text-center text-muted-foreground">{text}</CardContent></Card> }