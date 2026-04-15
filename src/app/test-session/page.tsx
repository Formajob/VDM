'use client'

import { useSession } from 'next-auth/react'

export default function TestSession() {
  const {  data:session, status } = useSession()
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Session</h1>
      <p className="mb-2">Status: <strong>{status}</strong></p>
      <pre className="mt-4 p-4 bg-slate-100 rounded text-xs overflow-auto">
        {JSON.stringify(session, null, 2)}
      </pre>
    </div>
  )
}