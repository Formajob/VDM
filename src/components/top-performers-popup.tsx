'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trophy, X } from 'lucide-react'

export default function TopPerformersPopup() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const today = new Date().toDateString()
    const seen = localStorage.getItem('top-performers-date')

    if (seen !== today) {
      setTimeout(() => {
        setOpen(true)
        localStorage.setItem('top-performers-date', today)
      }, 600)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden border-0 shadow-2xl animate-in fade-in zoom-in-95 duration-300">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Top Performers</h2>
              <p className="text-amber-100 text-sm">
                L'excellence qui inspire toute l'équipe VDM
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-white hover:bg-white/20 rounded-full">
            <X />
          </Button>
        </div>

        {/* CONTENU */}
        <div className="p-6 space-y-10 max-h-[75vh] overflow-y-auto">

          {/* Mois passé */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-amber-200" />
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm px-4 py-1.5 rounded-full">
                Mois passé
              </span>
              <div className="h-px flex-1 bg-amber-200" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="relative rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <img src="/photos/red-mois-passe.jpg" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-amber-300" />
                <h3 className="text-xl font-bold">Outhman</h3>
                <p className="text-sm text-amber-600 mb-4">⭐ Meilleur Rédacteur</p>
              </div>

              <div className="relative rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-6 text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                <img src="/photos/studio-mois-passe.jpg" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-orange-300" />
                <h3 className="text-xl font-bold">Driss</h3>
                <p className="text-sm text-orange-600 mb-4">⭐ Meilleur Studio</p>
              </div>
            </div>
          </div>

          {/* Mois en cours */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-indigo-200" />
              <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm px-4 py-1.5 rounded-full">
                {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <div className="h-px flex-1 bg-indigo-200" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="relative rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                <img src="/photos/red-mois-cours.jpg" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-indigo-300" />
                <h3 className="text-xl font-bold">Asmaa</h3>
                <p className="text-sm text-indigo-600 mb-4">⭐ Meilleur Rédacteur</p>
              </div>

              <div className="relative rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
                <img src="/photos/studio-mois-cours.jpg" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-purple-300" />
                <h3 className="text-xl font-bold">Driss</h3>
                <p className="text-sm text-purple-600 mb-4">⭐ Meilleur Studio</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-center">
          <Button onClick={() => setOpen(false)} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            Continuer vers la plateforme
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}