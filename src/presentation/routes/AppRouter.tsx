import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestRoute } from '@/presentation/routes/GuestRoute'
import { ProtectedRoute } from '@/presentation/routes/ProtectedRoute'
import { AdminLayout } from '@/presentation/layouts/AdminLayout'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { ChangePasswordPage } from '@/presentation/pages/ChangePasswordPage'
import { UsersPage } from '@/presentation/pages/UsersPage'
import { MobileAppPage } from '@/presentation/pages/MobileAppPage'
import { AreasPage } from '@/presentation/pages/AreasPage'
import { InstallationOrdersPage } from '@/presentation/pages/InstallationOrdersPage'
import { ActivityTechniciansPage } from '@/presentation/pages/ActivityTechniciansPage'
import { TechnicianWorkPage } from '@/presentation/pages/TechnicianWorkPage'
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
import { SupportPage } from '@/presentation/pages/SupportPage'
import { HomePage } from '@/presentation/pages/HomePage'
import { AppMenuKey, HOME_PATH } from '@/domain/value-objects/AppMenuPermission'

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
            <Route path={HOME_PATH} element={<HomePage />} />
            <Route path="/estaciones" element={<StationsPage />} />
            <Route path="/recursos-humanos" element={<PersonalPage />} />
            <Route path="/personal" element={<Navigate to="/recursos-humanos" replace />} />
            <Route path="/personal/roles" element={<Navigate to="/roles" replace />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/cargos" element={<CargosPage />} />
            <Route path="/localidades" element={<LocalidadesPage />} />
            <Route path="/documentacion" element={<Navigate to="/areas" replace />} />
            <Route path="/documentacion/:typeId" element={<Navigate to="/areas" replace />} />
            <Route path="/areas" element={<AreasPage />} />
            <Route path="/areas/:areaId/ordenes" element={<InstallationOrdersPage />} />
            <Route path="/areas/:areaId/tecnicos" element={<ActivityTechniciansPage />} />
            <Route
              path="/areas/:areaId/tecnicos/:technicianId"
              element={<TechnicianWorkPage />}
            />
            <Route path="/areas/:areaId/carpetas" element={<FoldersPage />} />
            <Route path="/tareas" element={<TasksPage />} />
            <Route path="/carpetas/:folderId" element={<FolderDetailPage />} />
            <Route
              path="/carpetas/:folderId/fechas/:dateId"
              element={<FolderDateDetailPage />}
            />
            <Route path="/asistencias" element={<AttendancePage />} />
            <Route path="/mapa" element={<MapPage />} />
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

        <Route element={<ProtectedRoute menuKey={AppMenuKey.Soporte} />}>
          <Route element={<AdminLayout />}>
            <Route path="/soporte" element={<SupportPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={HOME_PATH} replace />} />
        <Route path="/carpetas" element={<Navigate to="/areas" replace />} />
        <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
