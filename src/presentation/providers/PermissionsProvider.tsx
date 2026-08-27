import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ALL_APP_MENU_KEYS,
  AppMenuKey,
  type AppMenuKey as AppMenuKeyType,
} from '@/domain/value-objects/AppMenuPermission'
import {
  canManageOperationalRoles,
  UserRole,
} from '@/domain/value-objects/UserRole'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'

interface PermissionsContextValue {
  permissions: AppMenuKeyType[]
  loading: boolean
  canAccessMenu: (key: AppMenuKeyType) => boolean
  canManageRoles: boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    getOperationalRolePermissionsUseCase,
    ensureDefaultOperationalRolesUseCase,
  } = useDependencies()
  const [permissions, setPermissions] = useState<AppMenuKey[]>([])
  const [loading, setLoading] = useState(true)

  async function refreshPermissions() {
    if (!user) {
      setPermissions([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      await ensureDefaultOperationalRolesUseCase.execute(user)
      const next = await getOperationalRolePermissionsUseCase.execute(user)
      setPermissions(next)
    } catch {
      setPermissions([...ALL_APP_MENU_KEYS])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshPermissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.roles])

  const value = useMemo(
    () => ({
      permissions,
      loading,
      canAccessMenu: (key: AppMenuKeyType) => {
        if (key === AppMenuKey.Inicio) return true
        if (user?.role === UserRole.SuperAdministrador) return true
        if (key === AppMenuKey.Roles) {
          return Boolean(user && canManageOperationalRoles(user.role))
        }
        return permissions.includes(key)
      },
      canManageRoles: user ? canManageOperationalRoles(user.role) : false,
      refreshPermissions,
    }),
    [permissions, loading, user],
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): PermissionsContextValue {
  const value = useContext(PermissionsContext)
  if (!value) {
    throw new Error('usePermissions debe usarse dentro de PermissionsProvider')
  }
  return value
}
