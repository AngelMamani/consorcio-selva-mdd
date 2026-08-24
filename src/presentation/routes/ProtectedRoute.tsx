import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'
import { UserRole } from '@/domain/value-objects/UserRole'
import {
  pathToMenuKey,
  AppMenuKey,
  type AppMenuKey as AppMenuKeyType,
} from '@/domain/value-objects/AppMenuPermission'

interface ProtectedRouteProps {
  roles?: UserRole[]
  menuKey?: AppMenuKeyType
  allowPasswordChange?: boolean
}

export function ProtectedRoute({
  roles,
  menuKey,
  allowPasswordChange = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const { canAccessMenu, loading: permissionsLoading } = usePermissions()
  const location = useLocation()

  if (loading || permissionsLoading) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" />
        <p>Cargando sesión...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.active) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword && !allowPasswordChange) {
    return (
      <Navigate
        to="/cambiar-contrasena"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (!user.mustChangePassword && allowPasswordChange) {
    return <Navigate to="/areas" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/areas" replace />
  }

  const requiredMenuKey = menuKey ?? pathToMenuKey(location.pathname)
  if (
    requiredMenuKey &&
    !canAccessMenu(requiredMenuKey)
  ) {
    if (
      requiredMenuKey === AppMenuKey.Roles &&
      (user.role === UserRole.SuperAdministrador ||
        user.role === UserRole.Administrador)
    ) {
      return <Outlet />
    }
    return <Navigate to="/areas" replace />
  }

  return <Outlet />
}
