import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nanoid } from 'nanoid'

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN'
}

async function getOrCreateBalance(userId: string) {
  const year = new Date().getFullYear()
  const { data, error } = await supabaseAdmin
    .from('LeaveBalance')
    .select('*')
    .eq('userid', userId)
    .eq('year', year)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (data) {
    const lastUpdate = new Date(data.updatedat || data.createdat)
    const now = new Date()
    let monthsElapsed = 0
    const monthEnd = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth() + 1, 0, 23, 59, 59, 999)
    while (monthEnd <= now) {
      monthsElapsed += 1
      monthEnd.setTime(new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 2, 0, 23, 59, 59, 999).getTime())
    }
    if (monthsElapsed > 0) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('LeaveBalance')
        .update({ annualdays: Number(data.annualdays || 0) + monthsElapsed * 1.5, updatedat: now.toISOString() })
        .eq('id', data.id)
        .select()
        .single()
      if (updateError) throw updateError
      return { ...updated, exceptionaldays: 0, sickdays: 0 }
    }
    return { ...data, exceptionaldays: 0, sickdays: 0 }
  }

  const now = new Date()
  const newBalanceValues = {
    id: nanoid(), userid: userId, annualdays: 25,
    year, createdat: now.toISOString(), updatedat: now.toISOString(),
  }
  const { data: newBalance, error: insertError } = await supabaseAdmin
    .from('LeaveBalance')
    .insert(newBalanceValues)
    .select()
    .single()
  if (insertError) throw insertError
  return { ...newBalance, exceptionaldays: 0, sickdays: 0 }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || (session.user as any).id
    if (searchParams.get('all') === 'true') {
      if (!isAdmin(session)) return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })
      const { data: users, error: usersError } = await supabaseAdmin.from('User').select('id').eq('isActive', true)
      if (usersError) throw usersError
      return NextResponse.json(await Promise.all((users || []).map(user => getOrCreateBalance(user.id))))
    }
    return NextResponse.json(await getOrCreateBalance(userId))
  } catch (error) {
    console.error('Error fetching leave balance:', error)
    return NextResponse.json({ error: 'Failed to fetch leave balance' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })
    const body = await request.json()
    if (!body.userId) return NextResponse.json({ error: 'Membre requis' }, { status: 400 })
    const balance = await getOrCreateBalance(body.userId)
    const annualdays = Number(body.annualdays)
    if (!Number.isFinite(annualdays) || annualdays < 0) {
      return NextResponse.json({ error: 'Les soldes doivent être des nombres positifs' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('LeaveBalance')
      .update({ annualdays, updatedat: new Date().toISOString() })
      .eq('id', balance.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ...data, exceptionaldays: 0, sickdays: 0 })
  } catch (error: any) {
    console.error('Error updating leave balance:', error)
    return NextResponse.json({ error: error.message || 'Impossible de modifier le solde' }, { status: 500 })
  }
}