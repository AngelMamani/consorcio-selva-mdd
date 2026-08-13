import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/presentation/providers/AuthProvider'

export function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" />
        <p>Cargando sesión...</p>
      </div>
    )
  }

  if (user) {
    return (
      <Navigate
        to={user.mustChangePassword ? '/cambiar-contrasena' : '/carpetas'}
        replace
      />
    )
  }

  return <Outlet />
}
