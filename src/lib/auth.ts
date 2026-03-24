import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import * as bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const { data, error } = await supabaseAdmin
          .from('User')
          .select('*')
          .eq('email', credentials.email)
          .single()

        if (error || !data) return null
        if (!data.isActive) return null

        const isValid = await bcrypt.compare(credentials.password, data.password)
        if (!isValid) return null

        return {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          jobRole: data.jobRole,
          avatar: data.avatar,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.jobRole = (user as any).jobRole
        token.avatar = (user as any).avatar
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).role = token.role
        ;(session.user as any).jobRole = token.jobRole
        ;(session.user as any).avatar = token.avatar
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}