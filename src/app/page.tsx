import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, FileText, Users, Lock, Megaphone, Clock } from 'lucide-react'
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
            </div>
            <p className="text-muted-foreground mt-2 ml-8">{announcement.content}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

async function AnnouncementsFetcher() {
  const announcements = await getAnnouncements()
  return <AnnouncementsList announcements={announcements} />
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

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 text-sm px-4 py-1">
            Plateforme Interne — Xceed Maroc / VDM
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Gestion Opérationnelle de l'Équipe Audiodescription
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Pilotez vos projets, suivez les délais, gérez les présences et accédez à la base de données complète des personnages — tout en un seul espace dédié à l'équipe VD.
          </p>
          <div className="flex justify-center pt-4">
            <Link href="/login">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                <Lock className="h-4 w-4" />
                Accéder à la plateforme
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="border-2 border-indigo-100 hover:border-indigo-300 dark:border-indigo-900 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-lg">Gestion de Projets</CardTitle>
              <CardDescription>
                Suivez vos projets assignés par département — rédaction, narration, mixage, livraison — et ne manquez jamais une échéance.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-purple-100 hover:border-purple-300 dark:border-purple-900 transition-all hover:shadow-lg hover:shadow-purple-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-lg">Collaboration d'Équipe</CardTitle>
              <CardDescription>
                Travaillez en coordination avec votre équipe, partagez les mises à jour et restez alignés sur les priorités du moment.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-pink-100 hover:border-pink-300 dark:border-pink-900 transition-all hover:shadow-lg hover:shadow-pink-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-lg">Base de Données Personnages</CardTitle>
              <CardDescription>
                Accès rapide aux fiches personnages avec photos, voix et détails de casting pour chaque série et saison.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-emerald-100 hover:border-emerald-300 dark:border-emerald-900 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-lg">Pointage & Présences</CardTitle>
              <CardDescription>
                Pointage en temps réel, gestion des pauses, congés et absences, rapports d'équipe exportables et suivi des écarts.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

{/* Top Performers */}
<section className="container mx-auto px-4 py-12">
  <div className="max-w-5xl mx-auto">
    <div className="text-center mb-10">
      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-sm px-4 py-1 mb-4">
        🏆 Top Performers
      </Badge>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
        Félicitations à nos champions
      </h2>
      <p className="text-muted-foreground mt-2">
        L'excellence qui inspire toute l'équipe VDM
      </p>
    </div>

    {/* Mois passé */}
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full whitespace-nowrap">
          Mois passé
        </span>
        <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Top Rédaction — mois passé */}
        <div className="relative rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-800 p-6 text-center shadow-lg shadow-amber-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              ✍️ Top Rédaction
            </span>
          </div>
          <div className="w-24 h-24 rounded-full mx-auto mb-4 mt-2 overflow-hidden border-4 border-amber-300 shadow-lg">
            <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-3xl font-bold">
              <img src="/photos/red-mois-passe.jpg" alt="Top Rédaction" className="w-full h-full object-cover" />
            </div>
            {/* <img src="/photos/red-mois-passe.jpg" alt="Top Rédaction" className="w-full h-full object-cover" /> */}
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Outhman</h3>
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-4">⭐ Meilleur Rédacteur</p>
          <blockquote className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-amber-400 pl-4 text-left">
            "Votre plume est une arme redoutable. Mois après mois, vous démontrez qu'une rédaction de qualité 
            est le pilier de notre activité. Votre précision, votre rapidité et votre souci du détail 
            font de vous un modèle pour toute l'équipe. À chacun d'entre nous d'élever son niveau 
            à la hauteur de cet exemple !"
          </blockquote>
        </div>

        {/* Top Studio — mois passé */}
        <div className="relative rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 dark:border-orange-800 p-6 text-center shadow-lg shadow-orange-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              🎙️ Top Studio
            </span>
          </div>
          <div className="w-24 h-24 rounded-full mx-auto mb-4 mt-2 overflow-hidden border-4 border-orange-300 shadow-lg">
            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-3xl font-bold">
             <img src="/photos/studio-mois-passe.jpg" alt="Top Studio" className="w-full h-full object-cover" />
            </div>
            {/* <img src="/photos/studio-mois-passe.jpg" alt="Top Studio" className="w-full h-full object-cover" /> */}
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Driss</h3>
          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-4">⭐ Meilleur Studio</p>
          <blockquote className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-orange-400 pl-4 text-left">
            "Votre maîtrise du studio est exceptionnelle. Chaque session livrée avec vous porte 
            la marque d'un professionnel qui ne laisse rien au hasard. Votre oreille, votre technique 
            et votre calme sous pression sont des atouts précieux pour toute l'équipe. 
            Que votre rigueur soit une leçon pour nous tous !"
          </blockquote> 
        </div>

      </div>
    </div>

    {/* Mois en cours */}
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
        <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full whitespace-nowrap">
          {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <div className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Top Rédaction — mois en cours */}
        <div className="relative rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 dark:border-indigo-800 p-6 text-center shadow-lg shadow-indigo-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              ✍️ Top Rédaction
            </span>
          </div>
          <div className="w-24 h-24 rounded-full mx-auto mb-4 mt-2 overflow-hidden border-4 border-indigo-300 shadow-lg">
            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold">
              <img src="/photos/red-mois-cours.jpg" alt="Top Rédaction" className="w-full h-full object-cover" />
            </div>
            {/* <img src="/photos/red-mois-cours.jpg" alt="Top Rédaction" className="w-full h-full object-cover" /> */}
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Asmaa</h3>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-4">⭐ Meilleur Rédacteur</p>
          <blockquote className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-indigo-400 pl-4 text-left">
            "Ce mois-ci, vous avez montré ce que signifie s'investir corps et âme dans son travail. 
            La qualité de votre rédaction parle d'elle-même et force le respect de toute l'équipe. 
            Gardez cette dynamique — vous prouvez que l'excellence n'est pas un accident, 
            c'est une habitude. Inspirez ceux qui vous entourent à vous suivre !"
          </blockquote>
        </div>

        {/* Top Studio — mois en cours */}
        <div className="relative rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-800 p-6 text-center shadow-lg shadow-purple-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              🎙️ Top Studio
            </span>
          </div>
          <div className="w-24 h-24 rounded-full mx-auto mb-4 mt-2 overflow-hidden border-4 border-purple-300 shadow-lg">
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
              <img src="/photos/studio-mois-cours.jpg" alt="Top Studio" className="w-full h-full object-cover" />
            </div>
            {/* <img src="/photos/studio-mois-cours.jpg" alt="Top Studio" className="w-full h-full object-cover" /> */}
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Driss</h3>
          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-4">⭐ Meilleur Studio</p>
          <blockquote className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-purple-400 pl-4 text-left">
            "Votre performance en studio ce mois-ci est remarquable. Vous avez relevé chaque défi 
            avec professionnalisme et livré un travail dont toute l'équipe peut être fière. 
            Votre engagement est une motivation pour chacun d'entre nous à repousser ses limites. 
            Continuez à briller — vous montrez la voie !"
          </blockquote>
        </div>

      </div>
    </div>

  </div>
</section>


      {/* Announcements */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Actualités & Annonces
            </h2>
            <p className="text-muted-foreground">
              Restez informé avec les dernières communications internes de l'équipe
            </p>
          </div>
          <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Chargement des annonces...</div>}>
            <AnnouncementsFetcher />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-10">
          <div className="grid md:grid-cols-3 gap-8 mb-8">

            {/* Plateforme */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VDM</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Plateforme interne de gestion de l'équipe audiodescription.<br />
                Développée exclusivement pour <span className="font-medium text-slate-700 dark:text-slate-300">Xceed Maroc</span>.
              </p>
            </div>

            {/* Client */}
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Entreprise cliente</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-slate-700 dark:text-slate-300">Xceed Maroc</span><br />
                Entreprise mère de l'activité Vidéo Description (VD).<br />
                Plateforme créée et gérée pour les besoins internes de l'équipe VD.
              </p>
            </div>

            {/* Créateur */}
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Développée par</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-slate-700 dark:text-slate-300">Formjob</span><br />
                Solutions digitales sur mesure<br />
                <a
                  href="https://640e5d0f50ca9.site123.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  www.formajob.ma
                </a>
                <br />
                <a
                  href="tel:+212634232006"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  06 34 23 20 06
                </a>
              </p>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground text-center" >
              © {new Date().getFullYear()} Formjob — Tous droits réservés. Utilisation interne uniquement.
<br />
<span className="text-xs text-slate-800 dark:text-slate-200 font-semibold">
  Toutes les informations diffusées sur cette plateforme sont strictemesnt confidentielles. 
  Toute divulgation, reproduction ou partage non autorisé du contenu de cette plateforme 
  est formellement interdit et constitue une violation légale passible de poursuites.
</span>
            </p>
           
          </div>
        </div>
      </footer>
    </div>
  )
}
