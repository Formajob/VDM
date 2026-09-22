import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nanoid } from 'nanoid'

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN'
}

function countLeaveDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0

  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) days += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

async function getBalance(userId: string) {
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
        .update({
          annualdays: Number(data.annualdays || 0) + monthsElapsed * 1.5,
          updatedat: now.toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single()
      if (updateError) throw updateError
      return updated
    }
    return data
  }

  const now = new Date()
  const newBalanceValues = {
    id: nanoid(),
    userid: userId,
    annualdays: 25,
    year,
    createdat: now.toISOString(),
    updatedat: now.toISOString(),
  }
  const { data: newBalance, error: insertError } = await supabaseAdmin
    .from('LeaveBalance')
    .insert(newBalanceValues)
    .select()
    .single()
  if (insertError) throw insertError
  return { ...newBalance, exceptionaldays: 0, sickdays: 0 }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const admin = isAdmin(session)
    const userId = admin && body.userId ? body.userId : (session.user as any).id
    if (!userId || !body.startDate || !body.endDate || !body.type) {
      return NextResponse.json({ error: 'Données de congé incomplètes' }, { status: 400 })
    }
    if (countLeaveDays(body.startDate, body.endDate) === 0) {
      return NextResponse.json({ error: 'La période doit contenir au moins un jour ouvré' }, { status: 400 })
    }
    const now = new Date()

    const {  data, error } = await supabaseAdmin
      .from('LeaveRequest')
      .insert({
        id: nanoid(),
        userid: userId,
        startdate: body.startDate,
        enddate: body.endDate,
        type: body.type,
        reason: body.reason,
        status: 'PENDING',
        adminnote: body.adminNote,
        createdat: now.toISOString(),
        updatedat: now.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    if (admin && body.status === 'APPROVED') {
      await updateApprovedBalance(data)
      const { data: approved, error: approvalError } = await supabaseAdmin
        .from('LeaveRequest')
        .update({ status: 'APPROVED', updatedat: new Date().toISOString() })
        .eq('id', data.id)
        .select()
        .single()
      if (approvalError) throw approvalError
      return NextResponse.json(approved, { status: 201 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating leave request:', error)
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')
    const userId = isAdmin(session) ? requestedUserId : (session.user as any).id
    let query = supabaseAdmin
      .from('LeaveRequest')
      .select('*')
      .order('createdat', { ascending: false })

    if (userId) query = query.eq('userid', userId)

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

async function updateApprovedBalance(request: any) {
  const days = countLeaveDays(request.startdate, request.enddate)
  const balance = await getBalance(request.userid)
  const remaining = Number(balance.annualdays || 0) - days
  if (remaining < 0) throw new Error('Solde de congé insuffisant')

  const { error } = await supabaseAdmin
    .from('LeaveBalance')
    .update({ annualdays: remaining, updatedat: new Date().toISOString() })
    .eq('id', balance.id)
  if (error) throw error
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

    const body = await request.json()
    if (!body.id || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(body.status)) {
      return NextResponse.json({ error: 'Statut de demande invalide' }, { status: 400 })
    }

    const { data: current, error: fetchError } = await supabaseAdmin
      .from('LeaveRequest')
      .select('*')
      .eq('id', body.id)
      .single()
    if (fetchError) throw fetchError
    if (current.status !== 'PENDING') return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 409 })

    if (body.status === 'APPROVED') await updateApprovedBalance(current)
    const { data, error } = await supabaseAdmin
      .from('LeaveRequest')
      .update({ status: body.status, adminnote: body.adminNote || null, updatedat: new Date().toISOString() })
      .eq('id', body.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating leave request:', error)
    return NextResponse.json({ error: error.message || 'Impossible de traiter la demande' }, { status: 500 })
  }
}