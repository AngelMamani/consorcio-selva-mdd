import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestRoute } from '@/presentation/routes/GuestRoute'
import { ProtectedRoute } from '@/presentation/routes/ProtectedRoute'
import { AdminLayout } from '@/presentation/layouts/AdminLayout'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { ChangePasswordPage } from '@/presentation/pages/ChangePasswordPage'
import { UsersPage } from '@/presentation/pages/UsersPage'
import { FoldersPage } from '@/presentation/pages/FoldersPage'
import { FolderDetailPage } from '@/presentation/pages/FolderDetailPage'
import { MapPage } from '@/presentation/pages/MapPage'
import { UserRole } from '@/domain/value-objects/UserRole'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute allowPasswordChange />}>
          <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/carpetas" element={<FoldersPage />} />
            <Route path="/carpetas/:folderId" element={<FolderDetailPage />} />
            <Route path="/mapa" element={<MapPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={[UserRole.Administrador]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/carpetas" replace />} />
        <Route path="*" element={<Navigate to="/carpetas" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
