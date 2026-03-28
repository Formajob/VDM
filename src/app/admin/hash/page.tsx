'use client'

import { useState } from 'react'
import bcrypt from 'bcryptjs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function HashPage() {
  const [password, setPassword] = useState('')
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)

  const generateHash = async () => {
    if (!password) return

    setLoading(true)
    const hashed = await bcrypt.hash(password, 10)
    setHash(hashed)
    setLoading(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hash)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 p-6">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <CardTitle>🔐 Password Hasher</CardTitle>
          <CardDescription>
            Génère un hash sécurisé pour insertion manuelle en base
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            type="text"
            placeholder="Entrer le mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button onClick={generateHash} disabled={loading} className="w-full">
            {loading ? 'Génération...' : 'Générer le hash'}
          </Button>

          {hash && (
            <>
              <textarea
                value={hash}
                readOnly
                className="w-full p-2 border rounded text-sm"
                rows={3}
              />

              <Button onClick={copyToClipboard} variant="outline" className="w-full">
                Copier le hash
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}