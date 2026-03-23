'use client'

import { useEffect, useState } from 'react'

export interface DemoUser {
  id: string
  email: string
  name: string
  role: 'MEMBER' | 'ADMIN'
}

export function useDemoMode() {
  const [isDemo, setIsDemo] = useState(false)
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null)

  useEffect(() => {
    let mounted = true
    
    if (typeof window !== 'undefined') {
      const demoMode = localStorage.getItem('demoMode')
      const demoUserStr = localStorage.getItem('demoUser')
      
      if (demoMode === 'true' && demoUserStr && mounted) {
        const user = JSON.parse(demoUserStr)
        const demoRole = localStorage.getItem('demoRole') as 'MEMBER' | 'ADMIN' | null
        
        requestAnimationFrame(() => {
          if (mounted) {
            setIsDemo(true)
            setDemoUser({
              ...user,
              role: demoRole || 'MEMBER'
            })
          }
        })
      }
    }

    return () => {
      mounted = false
    }
  }, [])

  const exitDemoMode = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demoMode')
      localStorage.removeItem('demoUser')
      localStorage.removeItem('demoRole')
      setIsDemo(false)
      setDemoUser(null)
    }
  }

  return {
    isDemo,
    demoUser,
    exitDemoMode,
  }
}
