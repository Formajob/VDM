'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Users, BarChart3, Download } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'
import AttendanceSection from '@/components/AttendanceSection'

export default function AttendancePage() {
 const { data: session, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  const user: DemoUser | null = session?.user as DemoUser || demoUser

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

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
            Gestion des présences
          </h1>
          <p className="text-muted-foreground">Suivi des états de présence, validations et rapports</p>
        </div>

        {/* Ma présence */}
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Ma présence aujourd'hui
            </CardTitle>
            <CardDescription>Enregistrez votre statut en temps réel</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.id && <AttendanceSection userId={user.id} />}
          </CardContent>
        </Card>

        {/* Présences équipe (placeholder) */}
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Présences de l'équipe
            </CardTitle>
            <CardDescription>Vue d'ensemble des statuts de tous les membres</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-indigo-300" />
              <p>Tableau des présences équipe</p>
              <p className="text-sm">(Fonctionnalité à connecter)</p>
            </div>
          </CardContent>
        </Card>

        {/* Rapports */}
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Rapports
            </CardTitle>
            <CardDescription>Exportez les données de présence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button variant="outline" className="gap-2 border-indigo-200 hover:bg-indigo-50">
                <Download className="h-4 w-4" />Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}