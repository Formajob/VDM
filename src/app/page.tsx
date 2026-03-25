import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, FileText, Users, Lock, Megaphone, Play, Zap } from 'lucide-react'
import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

async function getAnnouncements() {
  const { data, error } = await supabaseAdmin
    .from('Announcement')
    .select(`
      *,
      createdBy:User!Announcement_createdById_fkey (
        name
      )
    `)
    .order('createdAt', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching announcements:', error)
    return []
  }
  return data
}

function AnnouncementsList({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune annonce pour le moment
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement) => (
        <Card key={announcement.id} className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Megaphone className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <CardTitle className="text-lg">{announcement.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(announcement.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {announcement.createdBy?.name && (
                      <>
                        <span>•</span>
                        <span>Par {announcement.createdBy.name}</span>
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
              {announcement.createdBy?.role === 'ADMIN' && (
                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">Admin</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{announcement.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VDM</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline" className="gap-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950">
                <Lock className="h-4 w-4" />
                Connexion
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 text-sm px-4 py-1">
            <Zap className="w-3 h-3 mr-1" />
            Plateforme Interne
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Plateforme Interne de l'Équipe VDM
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Rationalisez votre flux de travail de description audiodescription. Gérez vos projets,
            suivez les délais et accédez à la base de données complète des personnages.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/demo">
              <Button size="lg" className="w-full sm:w-auto gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                <Play className="h-4 w-4" />
                Essayer la démo
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950">
                <Lock className="h-4 w-4" />
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="border-2 border-indigo-100 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">Gestion de Projets</CardTitle>
              <CardDescription>
                Suivez vos projets assignés, surveillez les progrès et ne manquez jamais une échéance
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-purple-100 hover:border-purple-300 dark:border-purple-900 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">Collaboration d'Équipe</CardTitle>
              <CardDescription>
                Travaillez en harmonie avec votre équipe, partagez les mises à jour et restez coordonné
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-pink-100 hover:border-pink-300 dark:border-pink-900 dark:hover:border-pink-700 transition-all hover:shadow-lg hover:shadow-pink-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">Base de Données de Personnages</CardTitle>
              <CardDescription>
                Accès rapide aux informations des personnages avec photos et détails de casting
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* News & Updates Section */}
      <section className="container mx-auto px-4 py-12 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/50 dark:to-purple-950/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Actualités & Annonces</h2>
            <p className="text-muted-foreground">
              Restez informé avec les dernières annonces et communications internes
            </p>
          </div>
          <Suspense fallback={<div className="text-center py-8">Chargement des annonces...</div>}>
            <AnnouncementsFetcher />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VDM</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              © {new Date().getFullYear()} Équipe VDM. Utilisation interne uniquement.
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Connexion
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

async function AnnouncementsFetcher() {
  const announcements = await getAnnouncements()
  return <AnnouncementsList announcements={announcements} />
}
