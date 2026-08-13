import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/presentation/providers/AuthProvider'
import type { UserRole } from '@/domain/value-objects/UserRole'

interface ProtectedRouteProps {
  roles?: UserRole[]
  allowPasswordChange?: boolean
}

export function ProtectedRoute({
  roles,
  allowPasswordChange = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
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
    return <Navigate to="/carpetas" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/carpetas" replace />
  }

  return <Outlet />
}
