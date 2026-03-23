'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Lock, FileText, Users, Database, Zap, ArrowRight } from 'lucide-react'

export default function DemoPage() {
  const router = useRouter()

  useEffect(() => {
    // Store demo mode in localStorage
    localStorage.setItem('demoMode', 'true')
    localStorage.setItem('demoUser', JSON.stringify({
      id: 'demo-user-id',
      email: 'demo@vdm.com',
      name: 'Utilisateur Démo',
      role: 'MEMBER'
    }))
  }, [])

  const startDemo = (mode: 'member' | 'admin') => {
    localStorage.setItem('demoRole', mode)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-white text-sm font-medium">
            <Zap className="w-4 h-4" />
            Mode Démo Gratuit
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Découvrez VDM
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explorez toutes les fonctionnalités de la plateforme sans créer de compte
          </p>
        </div>

        {/* Demo Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Member Demo */}
          <Card className="border-2 border-indigo-200 hover:border-indigo-400 dark:border-indigo-800 dark:hover:border-indigo-600 transition-all hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer group">
            <CardHeader>
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Membre d'Équipe</CardTitle>
              <CardDescription className="text-base">
                Découvrez l'interface pour les rédacteurs VDM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span>Visualiser vos projets assignés</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span>Suivre les progrès et délais</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Database className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span>Accéder à la base de personnages</span>
                </li>
              </ul>
              <Button 
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/25"
                onClick={() => startDemo('member')}
              >
                <Play className="w-4 h-4 mr-2" />
                Commencer la démo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Admin Demo */}
          <Card className="border-2 border-purple-200 hover:border-purple-400 dark:border-purple-800 dark:hover:border-purple-600 transition-all hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer group">
            <CardHeader>
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Administrateur</CardTitle>
              <CardDescription className="text-base">
                Explorez le panneau d'administration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>Gérer les utilisateurs</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>Voir toutes les statistiques</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>Assigner des projets</span>
                </li>
              </ul>
              <Button 
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/25"
                onClick={() => startDemo('admin')}
              >
                <Play className="w-4 h-4 mr-2" />
                Commencer la démo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Box */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Aucune inscription requise</h3>
                <p className="text-sm text-muted-foreground">
                  Le mode démo vous permet d'explorer toutes les fonctionnalités de VDM gratuitement. 
                  Les données sont temporaires et ne seront pas sauvegardées.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  )
}
