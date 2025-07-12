// components/auth/AuthModal.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function AuthModal() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password
        })
        if (error) throw error
      }
    } catch (error) {
      console.error('Auth error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    // Auth form JSX here
    <form onSubmit={handleAuth} className="flex flex-col gap-4 p-4">
    <h2>{isLogin ? 'Login' : 'Register'}</h2>
    
    <input
      type="email"
      placeholder="Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="border px-2 py-1"
    />
    
    <input
      type="password"
      placeholder="Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="border px-2 py-1"
    />

    <button type="submit" className="bg-black text-white px-4 py-2">
      {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
    </button>

    <button
      type="button"
      onClick={() => setIsLogin(!isLogin)}
      className="text-blue-500 text-sm"
    >
      {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
    </button>
  </form>
  )
}