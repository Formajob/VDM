'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminAttendanceView from '@/components/AdminAttendanceView'
import AttendanceSection from '@/components/AttendanceSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

export default function AttendancePage() {
const { data, status } = useSession()

  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null
const isAdmin = user?.role === 'ADMIN'

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
            {isAdmin ? "Gestion des présences" : "Mes présences"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Suivi des états de présence, validations et rapports" : "Historique de vos états de présence"}
          </p>
        </div>

        {isAdmin ? (
          <AdminAttendanceView />
        ) : (
          <Card className="border-2 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                Historique de mes présences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user?.id && <AttendanceSection userId={user.id} />}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}