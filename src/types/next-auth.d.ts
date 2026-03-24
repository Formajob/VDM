import { UserRole, JobRole } from '@prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      jobRole: JobRole
      avatar?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    jobRole: JobRole
    avatar?: string | null
  }
}
