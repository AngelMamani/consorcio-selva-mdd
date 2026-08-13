import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@/domain/entities/User'
import { ThemePreference } from '@/domain/value-objects/ThemePreference'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'

interface AuthContextValue {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function applyTheme(theme: ThemePreference) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { observeSessionUseCase } = useDependencies()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = observeSessionUseCase.execute((nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return unsubscribe
  }, [observeSessionUseCase])

  useEffect(() => {
    applyTheme(user?.theme ?? ThemePreference.Light)
  }, [user?.theme])

  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return value
}
