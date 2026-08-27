import { Navigate, Outlet } from 'react-router-dom'
import { HOME_PATH } from '@/domain/value-objects/AppMenuPermission'
import { useAuth } from '@/presentation/providers/AuthProvider'

export function GuestRoute() {
  const { user, pendingRoleUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" />
        <p>Cargando sesión...</p>
      </div>
    )
  }

  if (pendingRoleUser && !user) {
    return <Outlet />
  }

  if (user) {
    return (
      <Navigate
        to={user.mustChangePassword ? '/cambiar-contrasena' : HOME_PATH}
        replace
      />
    )
  }

  return <Outlet />
}
