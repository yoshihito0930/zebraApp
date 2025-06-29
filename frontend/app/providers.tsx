"use client"

import { AuthProvider } from '../contexts/auth-context'

export default function ClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider>{children}</AuthProvider>
}
