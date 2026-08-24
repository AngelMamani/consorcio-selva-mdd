import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestRoute } from '@/presentation/routes/GuestRoute'
import { ProtectedRoute } from '@/presentation/routes/ProtectedRoute'
import { AdminLayout } from '@/presentation/layouts/AdminLayout'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { ChangePasswordPage } from '@/presentation/pages/ChangePasswordPage'
import { UsersPage } from '@/presentation/pages/UsersPage'
import { MobileAppPage } from '@/presentation/pages/MobileAppPage'
import { AreasPage } from '@/presentation/pages/AreasPage'
import { FoldersPage } from '@/presentation/pages/FoldersPage'
import { FolderDetailPage } from '@/presentation/pages/FolderDetailPage'
import { FolderDateDetailPage } from '@/presentation/pages/FolderDateDetailPage'
import { AttendancePage } from '@/presentation/pages/AttendancePage'
import { MapPage } from '@/presentation/pages/MapPage'
import { StationsPage } from '@/presentation/pages/StationsPage'
import { TasksPage } from '@/presentation/pages/TasksPage'
import { PersonalPage } from '@/presentation/pages/PersonalPage'
import { RolesPage } from '@/presentation/pages/RolesPage'
import { CargosPage } from '@/presentation/pages/CargosPage'
import { LocalidadesPage } from '@/presentation/pages/LocalidadesPage'
import { DocumentationPage } from '@/presentation/pages/DocumentationPage'
import { DocumentationTypeDetailPage } from '@/presentation/pages/DocumentationTypeDetailPage'
import { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'

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
            <Route path="/estaciones" element={<StationsPage />} />
            <Route path="/personal" element={<PersonalPage />} />
            <Route path="/personal/roles" element={<RolesPage />} />
            <Route path="/cargos" element={<CargosPage />} />
            <Route path="/localidades" element={<LocalidadesPage />} />
            <Route path="/areas" element={<AreasPage />} />
            <Route path="/areas/:areaId/carpetas" element={<FoldersPage />} />
            <Route path="/tareas" element={<TasksPage />} />
            <Route path="/carpetas/:folderId" element={<FolderDetailPage />} />
            <Route
              path="/carpetas/:folderId/fechas/:dateId"
              element={<FolderDateDetailPage />}
            />
            <Route path="/asistencias" element={<AttendancePage />} />
            <Route path="/mapa" element={<MapPage />} />
            <Route path="/documentacion" element={<DocumentationPage />} />
            <Route
              path="/documentacion/:typeId"
              element={<DocumentationTypeDetailPage />}
            />
          </Route>
        </Route>

        <Route element={<ProtectedRoute menuKey={AppMenuKey.Usuarios} />}>
          <Route element={<AdminLayout />}>
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute menuKey={AppMenuKey.AppMovil} />}>
          <Route element={<AdminLayout />}>
            <Route path="/app-movil" element={<MobileAppPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/areas" replace />} />
        <Route path="/carpetas" element={<Navigate to="/areas" replace />} />
        <Route path="*" element={<Navigate to="/areas" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
