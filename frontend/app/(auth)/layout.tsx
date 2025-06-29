"use client";

import React from 'react';
import { AuthProvider } from '../../contexts/auth-context';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
