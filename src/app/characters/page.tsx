'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  User,
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  Film,
  Users as UsersIcon,
  Camera,
  Zap,
} from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

interface Series {
  id: string
  name: string
  description: string | null
  seasons: Season[]
  _count: { seasons: number }
}

interface Season {
  id: string
  number: number
  year: number | null
  seriesId: string
  _count: { characters: number }
}

interface Character {
  id: string
  name: string
  actorName: string
  photoUrl: string | null
  season: {
    number: number
    year: number | null
    series: {
      name: string
    }
  }
}

export default function CharactersPage() {
  const { data: session, status } = useSession()
  const { isDemo, demoUser, exitDemoMode } = useDemoMode()
  const router = useRouter()
  const [series, setSeries] = useState<Series[]>([])
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('all')
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAddCharacterDialog, setShowAddCharacterDialog] = useState(false)
  const [showAddSeriesDialog, setShowAddSeriesDialog] = useState(false)
  const [showAddSeasonDialog, setShowAddSeasonDialog] = useState(false)
  
  const user: DemoUser | null = session?.user as DemoUser || demoUser
  const isAdmin = user?.role === 'ADMIN'

  const [newCharacter, setNewCharacter] = useState({
    name: '',
    actorName: '',
    photoUrl: '',
    seasonId: '',
  })

  const [newSeries, setNewSeries] = useState({
    name: '',
    description: '',
  })

  const [newSeason, setNewSeason] = useState({
    seriesId: '',
    number: '',
    year: '',
  })

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router, isDemo])

  useEffect(() => {
    if (user) {
      fetchSeries()
      fetchCharacters()
    }
  }, [user, selectedSeriesId, selectedSeasonId, searchQuery])

  const handleSignOut = () => {
    if (isDemo) {
      exitDemoMode()
      router.push('/')
    } else {
      signOut({ callbackUrl: '/' })
    }
  }

  const fetchSeries = async () => {
    try {
      const res = await fetch('/api/series')
      if (res.ok) {
        const data = await res.json()
        setSeries(data)
      }
    } catch (error) {
      console.error('Error fetching series:', error)
    }
  }

  const fetchCharacters = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (searchQuery) params.append('search', searchQuery)
      if (selectedSeasonId !== 'all') params.append('seasonId', selectedSeasonId)

      const res = await fetch(`/api/characters?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCharacters(data)
      }
    } catch (error) {
      console.error('Error fetching characters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCharacter = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCharacter),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Échec de l\'ajout du personnage')
      }

      toast.success('Personnage ajouté avec succès')
      setShowAddCharacterDialog(false)
      setNewCharacter({ name: '', actorName: '', photoUrl: '', seasonId: '' })
      fetchCharacters()
    } catch (error: any) {
      toast.error(error.message || 'Échec de l\'ajout du personnage')
    }
  }

  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSeries),
      })

      if (!res.ok) throw new Error('Échec de l\'ajout de la série')

      toast.success('Série ajoutée avec succès')
      setShowAddSeriesDialog(false)
      setNewSeries({ name: '', description: '' })
      fetchSeries()
    } catch (error) {
      toast.error('Échec de l\'ajout de la série')
    }
  }

  const handleAddSeason = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSeason,
          number: parseInt(newSeason.number),
          year: newSeason.year ? parseInt(newSeason.year) : null,
        }),
      })

      if (!res.ok) throw new Error('Échec de l\'ajout de la saison')

      toast.success('Saison ajoutée avec succès')
      setShowAddSeasonDialog(false)
      setNewSeason({ seriesId: '', number: '', year: '' })
      fetchSeries()
    } catch (error) {
      toast.error('Échec de l\'ajout de la saison')
    }
  }

  const selectedSeries = series.find((s) => s.id === selectedSeriesId)
  const seasons = selectedSeries?.seasons || []

  if ((status === 'loading' && !isDemo) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-md shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-6 w-6 text-indigo-600" /> : <Menu className="h-6 w-6 text-indigo-600" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-r border-indigo-100 dark:border-indigo-900 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VDM</span>
          </div>

          <nav className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              onClick={() => router.push('/dashboard')}
            >
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord
            </Button>

            {isAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => router.push('/admin')}
              >
                <Settings className="h-4 w-4" />
                Administration
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300"
            >
              <User className="h-4 w-4" />
              Base de données
            </Button>
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-indigo-100 dark:border-indigo-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <UsersIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
                {isDemo && (
                  <Badge className="mt-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs border-0">
                    <Zap className="w-3 h-3 mr-1" />
                    Mode Démo
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Base de Données des Personnages
              </h1>
              <p className="text-muted-foreground">
                Parcourez et gérez les informations des personnages de toutes les séries
              </p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Dialog open={showAddSeriesDialog} onOpenChange={setShowAddSeriesDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 dark:border-indigo-700 dark:hover:bg-indigo-950/30">
                        <Film className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        Ajouter une série
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-xl">Ajouter une nouvelle série</DialogTitle>
                        <DialogDescription>
                          Créer une nouvelle série pour organiser les personnages.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddSeries}>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="seriesName">Nom de la série</Label>
                            <Input
                              id="seriesName"
                              value={newSeries.name}
                              onChange={(e) => setNewSeries({ ...newSeries, name: e.target.value })}
                              required
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="seriesDescription">Description (optionnel)</Label>
                            <Input
                              id="seriesDescription"
                              value={newSeries.description}
                              onChange={(e) => setNewSeries({ ...newSeries, description: e.target.value })}
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowAddSeriesDialog(false)} className="border-slate-300">
                            Annuler
                          </Button>
                          <Button type="submit" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
                            Ajouter la série
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showAddSeasonDialog} onOpenChange={setShowAddSeasonDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-950/30">
                        <Film className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Ajouter une saison
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-xl">Ajouter une nouvelle saison</DialogTitle>
                        <DialogDescription>Ajouter une saison à une série existante.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddSeason}>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="seasonSeries">Série</Label>
                            <Select
                              value={newSeason.seriesId}
                              onValueChange={(value) => setNewSeason({ ...newSeason, seriesId: value })}
                            >
                              <SelectTrigger className="border-indigo-200 focus:border-indigo-500">
                                <SelectValue placeholder="Sélectionner une série" />
                              </SelectTrigger>
                              <SelectContent>
                                {series.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="seasonNumber">Numéro de saison</Label>
                            <Input
                              id="seasonNumber"
                              type="number"
                              min="1"
                              value={newSeason.number}
                              onChange={(e) => setNewSeason({ ...newSeason, number: e.target.value })}
                              required
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="seasonYear">Année (optionnel)</Label>
                            <Input
                              id="seasonYear"
                              type="number"
                              value={newSeason.year}
                              onChange={(e) => setNewSeason({ ...newSeason, year: e.target.value })}
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowAddSeasonDialog(false)} className="border-slate-300">
                            Annuler
                          </Button>
                          <Button type="submit" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                            Ajouter la saison
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showAddCharacterDialog} onOpenChange={setShowAddCharacterDialog}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg shadow-indigo-500/25">
                        <Plus className="h-4 w-4" />
                        Ajouter un personnage
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-xl">Ajouter un nouveau personnage</DialogTitle>
                        <DialogDescription>Ajouter un nouveau personnage à la base de données.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddCharacter}>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="charName">Nom du personnage</Label>
                            <Input
                              id="charName"
                              value={newCharacter.name}
                              onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                              required
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="actorName">Nom de l'acteur</Label>
                            <Input
                              id="actorName"
                              value={newCharacter.actorName}
                              onChange={(e) => setNewCharacter({ ...newCharacter, actorName: e.target.value })}
                              required
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="season">Saison</Label>
                            <Select
                              value={newCharacter.seasonId}
                              onValueChange={(value) => setNewCharacter({ ...newCharacter, seasonId: value })}
                            >
                              <SelectTrigger className="border-indigo-200 focus:border-indigo-500">
                                <SelectValue placeholder="Sélectionner une saison" />
                              </SelectTrigger>
                              <SelectContent>
                                {series.flatMap((s) =>
                                  s.seasons.map((season) => (
                                    <SelectItem key={season.id} value={season.id}>
                                      {s.name} - Saison {season.number}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="photoUrl">URL de la photo (optionnel)</Label>
                            <Input
                              id="photoUrl"
                              placeholder="https://..."
                              value={newCharacter.photoUrl}
                              onChange={(e) => setNewCharacter({ ...newCharacter, photoUrl: e.target.value })}
                              className="border-indigo-200 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowAddCharacterDialog(false)} className="border-slate-300">
                            Annuler
                          </Button>
                          <Button type="submit" className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white">
                            Ajouter le personnage
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <Card className="border-2 border-indigo-100 dark:border-indigo-900 shadow-lg shadow-indigo-500/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-400" />
                  <Input
                    placeholder="Rechercher par nom de personnage ou d'acteur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <Select value={selectedSeriesId} onValueChange={(value) => {
                  setSelectedSeriesId(value)
                  setSelectedSeasonId('all')
                }}>
                  <SelectTrigger className="w-full md:w-[200px] border-indigo-200 focus:border-indigo-500">
                    <SelectValue placeholder="Filtrer par série" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les séries</SelectItem>
                    {series.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedSeasonId}
                  onValueChange={setSelectedSeasonId}
                  disabled={!selectedSeries || selectedSeriesId === 'all'}
                >
                  <SelectTrigger className="w-full md:w-[200px] border-indigo-200 focus:border-indigo-500">
                    <SelectValue placeholder="Filtrer par saison" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les saisons</SelectItem>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        Saison {season.number} {season.year && `(${season.year})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Characters Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
            </div>
          ) : characters.length === 0 ? (
            <Card className="p-12 border-2 border-dashed border-indigo-200 dark:border-indigo-800">
              <div className="text-center space-y-4">
                <Camera className="h-12 w-12 text-indigo-300 dark:text-indigo-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium">Aucun personnage trouvé</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || selectedSeriesId !== 'all' || selectedSeasonId !== 'all'
                      ? 'Essayez d\'ajuster vos filtres ou votre recherche'
                      : 'Aucun personnage n\'a été ajouté pour le moment'}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {characters.map((character, index) => {
                const colorClasses = [
                  'from-indigo-500 to-indigo-600',
                  'from-purple-500 to-purple-600',
                  'from-pink-500 to-pink-600',
                  'from-indigo-500 to-purple-500',
                ]
                const gradientClass = colorClasses[index % colorClasses.length]
                
                return (
                  <Card 
                    key={character.id} 
                    className="overflow-hidden border-2 border-indigo-100 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-700 transition-all hover:shadow-xl hover:shadow-indigo-500/10 group"
                  >
                    {character.photoUrl ? (
                      <div className="aspect-square overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50">
                        <img
                          src={character.photoUrl}
                          alt={character.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="hidden aspect-square flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
                          <User className="h-16 w-16 text-indigo-400 dark:text-indigo-600" />
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
                        <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg shadow-indigo-500/25`}>
                          <span className="text-2xl font-bold text-white">
                            {character.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg line-clamp-1 text-slate-900 dark:text-white">{character.name}</CardTitle>
                      <CardDescription className="text-sm line-clamp-1">
                        {character.actorName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Badge className={`bg-gradient-to-r ${gradientClass} text-white border-0`}>
                          {character.season.series.name}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Saison {character.season.number}
                          {character.season.year && ` • ${character.season.year}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
