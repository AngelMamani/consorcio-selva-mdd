import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@/domain/entities/User'
import { ThemePreference } from '@/domain/value-objects/ThemePreference'
import {
  webAccessRoles,
  type UserRole,
} from '@/domain/value-objects/UserRole'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import {
  clearStoredActiveRole,
  overlayWebActiveRole,
  writeStoredActiveRole,
} from '@/presentation/utils/activeRoleSession'

interface AuthContextValue {
  user: User | null
  pendingRoleUser: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setActiveRole: (role: UserRole, sourceUser?: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function applyTheme(theme: ThemePreference) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { observeSessionUseCase, logoutUseCase } = useDependencies()
  const [user, setUserState] = useState<User | null>(null)
  const [pendingRoleUser, setPendingRoleUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  function setUser(next: User | null) {
    if (!next) {
      clearStoredActiveRole()
      setPendingRoleUser(null)
      setUserState(null)
      return
    }
    const web = webAccessRoles(next)
    if (web.length === 0) {
      clearStoredActiveRole()
      setPendingRoleUser(null)
      setUserState(null)
      void logoutUseCase.execute()
      return
    }
    const overlaid = overlayWebActiveRole(next)
    if (!overlaid) {
      setPendingRoleUser(next)
      setUserState(null)
      return
    }
    setPendingRoleUser(null)
    setUserState(overlaid)
  }

  function setActiveRole(role: UserRole, sourceUser?: User) {
    const source = sourceUser ?? user ?? pendingRoleUser
    if (!source) return
    const web = webAccessRoles(source)
    if (!web.includes(role)) return
    writeStoredActiveRole(role)
    setPendingRoleUser(null)
    setUserState({ ...source, role })
  }

  useEffect(() => {
    const unsubscribe = observeSessionUseCase.execute((nextUser) => {
      if (!nextUser) {
        clearStoredActiveRole()
        setPendingRoleUser(null)
        setUserState(null)
        setLoading(false)
        return
      }
      const web = webAccessRoles(nextUser)
      if (web.length === 0) {
        clearStoredActiveRole()
        setPendingRoleUser(null)
        setUserState(null)
        setLoading(false)
        void logoutUseCase.execute()
        return
      }
      const overlaid = overlayWebActiveRole(nextUser)
      if (!overlaid) {
        setPendingRoleUser(nextUser)
        setUserState(null)
        setLoading(false)
        return
      }
      setPendingRoleUser(null)
      setUserState(overlaid)
      setLoading(false)
    })

    return unsubscribe
  }, [observeSessionUseCase, logoutUseCase])

  useEffect(() => {
    applyTheme(user?.theme ?? ThemePreference.Light)
  }, [user?.theme])

  return (
    <AuthContext.Provider
      value={{ user, pendingRoleUser, loading, setUser, setActiveRole }}
    >
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
