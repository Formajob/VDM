'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { User, Lock, Mail, Briefcase, Calendar, Shield, Eye, EyeOff } from 'lucide-react'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'

export default function AccountPage() {
  const { data, status, update } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()
  
  const user: DemoUser | null = (data?.user as DemoUser) || demoUser || null

  // États pour les informations du profil
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [jobRole, setJobRole] = useState('')
  
  // États pour le changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // États de chargement
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [userDetails, setUserDetails] = useState<any>(null)

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
  }, [status, router, isDemo])

  useEffect(() => {
    if (user) {
      fetchUserDetails()
    }
  }, [user])

  const fetchUserDetails = async () => {
    if (!user?.id) return
    
    try {
      const res = await fetch(`/api/users/${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setUserDetails(data)
        setName(data.name || '')
        setEmail(data.email || '')
        setJobRole(data.jobRole || '')
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Email invalide')
      return
    }

    setLoadingProfile(true)

    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, jobRole }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erreur lors de la mise à jour')
      }

      await update() // Mettre à jour la session
      toast.success('Profil mis à jour avec succès ! 🎉')
      fetchUserDetails()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Impossible de mettre à jour le profil')
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Tous les champs sont requis')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    if (newPassword === currentPassword) {
      toast.error('Le nouveau mot de passe doit être différent de l\'ancien')
      return
    }

    setLoadingPassword(true)

    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          currentPassword,
          newPassword,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erreur lors du changement de mot de passe')
      }

      toast.success('Mot de passe modifié avec succès ! 🔒')
      
      // Réinitialiser les champs
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast.error(error.message || 'Impossible de changer le mot de passe')
    } finally {
      setLoadingPassword(false)
    }
  }

  if (!isDemo && status === 'loading') {
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
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Mon Compte
          </h1>
          <p className="text-muted-foreground">Gérez vos informations personnelles et vos paramètres</p>
        </div>

        {/* Informations du compte */}
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Informations du compte
                </CardTitle>
                <CardDescription>Vos informations personnelles</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {user?.role === 'ADMIN' ? '👑 Administrateur' : '👤 Membre'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      placeholder="Votre nom"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="votre@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobRole">Poste</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="jobRole"
                      type="text"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      className="pl-10"
                      placeholder="Votre poste"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contactez un administrateur pour modifier votre poste
                  </p>
                </div>

                {userDetails?.createdat && (
                  <div className="space-y-2">
                    <Label>Membre depuis</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={new Date(userDetails.createdat).toLocaleDateString('fr-FR', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                        className="pl-10"
                        disabled
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  disabled={loadingProfile}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {loadingProfile ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer les modifications'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Changement de mot de passe */}
        <Card className="border-2 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Sécurité
            </CardTitle>
            <CardDescription>Modifiez votre mot de passe</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 caractères
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="font-medium mb-1">🔒 Conseils de sécurité</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Utilisez au moins 8 caractères</li>
                  <li>Incluez des lettres majuscules et minuscules</li>
                  <li>Ajoutez des chiffres et des caractères spéciaux</li>
                  <li>N'utilisez pas d'informations personnelles</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={loadingPassword}
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {loadingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-700 border-t-transparent mr-2"></div>
                      Modification...
                    </>
                  ) : (
                    'Changer le mot de passe'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Informations supplémentaires */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID utilisateur</span>
                <span className="font-mono text-xs">{user?.id}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut du compte</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Actif
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rôle</span>
                <span className="font-medium">
                  {user?.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}