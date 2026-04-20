import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await req.json()
    const { userId, currentPassword, newPassword } = body

    // Vérifier que l'utilisateur modifie son propre mot de passe
    if (session.user.id !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ 
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' 
      }, { status: 400 })
    }

    // Récupérer l'utilisateur avec son mot de passe
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('User')
      .select('password')
      .eq('id', userId)
      .single()

    if (fetchError || !user) {
      console.error('❌ User fetch error:', fetchError)
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
    
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 })
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabaseAdmin
      .from('User')
      .update({ 
        password: hashedPassword,
        updatedat: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Password update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Mot de passe modifié avec succès' })
  } catch (e: any) {
    console.error('❌ Change password error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}