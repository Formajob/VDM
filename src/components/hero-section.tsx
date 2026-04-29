'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, X, Trophy, Star, Sparkles } from 'lucide-react'

// ============ COMPOSANT CONFETTIS ============
function ConfettiParticle({ delay, color, left }: { delay: number; color: string; left: number }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full animate-confetti"
      style={{
        left: `${left}%`,
        top: '-10px',
        backgroundColor: color,
        animationDelay: `${delay}ms`,
        animationDuration: '3s',
        animationFillMode: 'forwards',
      }}
    />
  )
}

function ConfettiExplosion() {
  const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f97316']
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 2000,
    color: colors[Math.floor(Math.random() * colors.length)],
    left: Math.random() * 100,
  }))

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[110]">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} left={p.left} />
      ))}
    </div>
  )
}

// ============ TEXTE ANIMÉ "BRAVO" ============
function AnimatedBravo() {
  return (
    <div className="flex justify-center gap-1 mb-4 animate-bounce-in">
      {['B', 'R', 'A', 'V', 'O', '!'].map((letter, i) => (
        <span
          key={i}
          className="text-4xl md:text-6xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent animate-letter-pop"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}

// ============ TROPHÉE PULSANT ============
function PulsingTrophy() {
  return (
    <div className="flex justify-center mb-4">
      <div className="relative">
        <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-50 animate-pulse-scale" />
        <Trophy className="h-16 w-16 md:h-20 md:w-20 text-amber-500 relative z-10 animate-trophy-bounce" />
        <Sparkles className="h-6 w-6 text-amber-400 absolute -top-2 -right-2 animate-sparkle" />
        <Star className="h-5 w-5 text-orange-400 absolute -bottom-1 -left-3 animate-sparkle-delayed" />
      </div>
    </div>
  )
}

// ============ COMPOSANT PRINCIPAL ============
export function HeroSection() {
  const [showTopPerformers, setShowTopPerformers] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)

  // Afficher automatiquement le popup au chargement
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTopPerformers(true)
      setShowAnimation(true)
      // Arrêter l'animation après 4 secondes
      const animTimer = setTimeout(() => setShowAnimation(false), 4000)
      return () => clearTimeout(animTimer)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = useCallback(() => {
    setShowTopPerformers(false)
    setShowAnimation(false)
  }, [])

  const handleOpen = useCallback(() => {
    setShowTopPerformers(true)
    setShowAnimation(true)
    setTimeout(() => setShowAnimation(false), 4000)
  }, [])

  return (
    <>
      {/* ============ HERO — TOUJOURS VISIBLE ============ */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 text-sm px-4 py-1">
            Plateforme Interne — Xceed Maroc / VDM
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Gestion Opérationnelle de l'Équipe Audiodescription
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pilotez vos projets, suivez les délais, gérez les présences et accédez au suivi de performance.
          </p>
          <div className="flex justify-center gap-4 pt-2"> 
            <Link href="/login">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                <Lock className="h-4 w-4" />
                Accéder à la plateforme
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline"
              className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-500 dark:hover:bg-amber-950"
              onClick={handleOpen}
            >
              🏆 Top Performers
            </Button>
          </div>
        </div>
      </section>

      {/* ============ ANIMATIONS DE FÉLICITATIONS ============ */}
      {showAnimation && <ConfettiExplosion />}

      {/* ============ POPUP OVERLAY ============ */}
      {showTopPerformers && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          {/* Popup Content */}
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            
            {/* Bouton fermer */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>

            {/* ============ HEADER AVEC ANIMATIONS ============ */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b px-6 py-6 text-center z-[5] overflow-hidden">
              
              {/* Animations de félicitations (visibles 4s) */}
              {showAnimation && (
                <div className="mb-2 animate-fade-out" style={{ animationDelay: '3.5s' }}>
                  <AnimatedBravo />
                  <PulsingTrophy />
                </div>
              )}

              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-sm px-4 py-1 mb-2">
                🏆 Top Performers
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mt-2">
                Félicitations à nos champions
              </h2>
              <p className="text-muted-foreground text-sm mt-2">
                L'excellence qui inspire toute l'équipe VDM
              </p>
            </div>

            {/* ============ CONTENU ============ */}
            <div className="p-6">
              {/* Mois passé */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full whitespace-nowrap">
                    Mois passé
                  </span>
                  <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top Rédaction — mois passé */}
                  <div className="relative rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-800 p-4 text-center shadow-lg shadow-amber-500/10 hover:scale-[1.02] transition-transform">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        ✍️ Top Rédaction
                      </span>
                    </div>
                    <div className="w-20 h-20 rounded-full mx-auto mb-3 mt-2 overflow-hidden border-4 border-amber-300 shadow-lg">
                      <img src="/photos/red-mois-passe.jpg" alt="Top Rédaction" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Asmaa</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3">⭐ Meilleur Rédactrice</p>
                    <blockquote className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-amber-400 pl-3 text-left">
                      "Votre plume est une arme redoutable. Mois après mois, vous démontrez qu'une rédaction de qualité 
                      est le pilier de notre activité. Votre précision, votre rapidité et votre souci du détail 
                      font de vous un modèle pour toute l'équipe."
                    </blockquote>
                  </div>

                  {/* Top Studio — mois passé */}
                  <div className="relative rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 dark:border-orange-800 p-4 text-center shadow-lg shadow-orange-500/10 hover:scale-[1.02] transition-transform">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        🎙️ Top Studio
                      </span>
                    </div>
                    <div className="w-20 h-20 rounded-full mx-auto mb-3 mt-2 overflow-hidden border-4 border-orange-300 shadow-lg">
                      <img src="/photos/studio-mois-passe.jpg" alt="Top Studio" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Driss</h3>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-3">⭐ Meilleur Studio</p>
                    <blockquote className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-orange-400 pl-3 text-left">
                      "Votre maîtrise du studio est exceptionnelle. Chaque session livrée avec vous porte 
                      la marque d'un professionnel qui ne laisse rien au hasard. Votre oreille, votre technique 
                      et votre calme sous pression sont des atouts précieux pour toute l'équipe."
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

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top Rédaction — mois en cours */}
                  <div className="relative rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 dark:border-indigo-800 p-4 text-center shadow-lg shadow-indigo-500/10 hover:scale-[1.02] transition-transform">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        ✍️ Top Rédaction
                      </span>
                    </div>
                    <div className="w-20 h-20 rounded-full mx-auto mb-3 mt-2 overflow-hidden border-4 border-indigo-300 shadow-lg">
                      <img src="/photos/red-mois-cours.jpg" alt="Top Rédaction" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Loubna</h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-3">⭐ Meilleur Rédactrice</p>
                    <blockquote className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-indigo-400 pl-3 text-left">
                      "Ce mois-ci, vous avez montré ce que signifie s'investir corps et âme dans son travail. 
                      La qualité de votre rédaction parle d'elle-même et force le respect de toute l'équipe. 
                      Gardez cette dynamique — vous prouvez que l'excellence n'est pas un accident."
                    </blockquote>
                  </div>

                  {/* Top Studio — mois en cours */}
                  <div className="relative rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-800 p-4 text-center shadow-lg shadow-purple-500/10 hover:scale-[1.02] transition-transform">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        🎙️ Top Studio
                      </span>
                    </div>
                    <div className="w-20 h-20 rounded-full mx-auto mb-3 mt-2 overflow-hidden border-4 border-purple-300 shadow-lg">
                      <img src="/photos/studio-mois-cours.jpg" alt="Top Studio" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Driss</h3>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-3">⭐ Meilleur Studio</p>
                    <blockquote className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed border-l-4 border-purple-400 pl-3 text-left">
                      "Votre performance en studio ce mois-ci est remarquable. Vous avez relevé chaque défi 
                      avec professionnalisme et livré un travail dont toute l'équipe peut être fière. 
                      Votre engagement est une motivation pour chacun d'entre nous."
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}