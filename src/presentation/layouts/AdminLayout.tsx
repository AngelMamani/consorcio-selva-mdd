import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'
import { UserRole, userRoleLabel } from '@/domain/value-objects/UserRole'
import {
  APP_MENU_DEFINITIONS,
  APP_MENU_MODULES,
  AppMenuKey,
} from '@/domain/value-objects/AppMenuPermission'
import { ThemePreference } from '@/domain/value-objects/ThemePreference'
import './AdminLayout.css'

const SIDEBAR_COLLAPSED_KEY = 'consorcio-sidebar-collapsed'

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M4.5 11.2 12 4.8l7.5 6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 10.6V19.5h10.8V10.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AreasIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 12v9M4 7.5l8 4.5 8-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AttendanceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M8 3.5h8A3.5 3.5 0 0 1 19.5 7v11A3.5 3.5 0 0 1 16 21.5H8A3.5 3.5 0 0 1 4.5 18V7A3.5 3.5 0 0 1 8 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 8.5h8M8 12.5h5M8.2 16.2 10 18l3.5-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StaffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M8.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16.5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.8 19.2c.5-2.8 2.8-4.4 5.7-4.4s5.2 1.6 5.7 4.4M13.4 14.2c1 .4 2.2.6 3.4.6 2.4 0 4.2-1.1 4.6-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M16.5 8.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4.5 18.2c.5-2.6 2.9-4.2 6-4.2h3c3.1 0 5.5 1.6 6 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M8 3.5h8A2.5 2.5 0 0 1 18.5 6v12A2.5 2.5 0 0 1 16 20.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 17.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M12 3.5c-3.4 0-6.2 2.7-6.2 6.1 0 4.6 6.2 10.9 6.2 10.9s6.2-6.3 6.2-10.9c0-3.4-2.8-6.1-6.2-6.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="9.6"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M9.5 4.2 3.8 6.4v13l5.7-2.2 5 2.2 5.7-2.2v-13L14.5 6.4 9.5 4.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 4.2v13M14.5 6.4v13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        d="M19.5 13.2A7.5 7.5 0 0 1 10.8 4.5 7.8 7.8 0 1 0 19.5 13.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        fill="currentColor"
        d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z"
      />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CloseMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        d="m6 6 12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CollapseSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        d="M8 5.5v13M15.5 8 12 12l3.5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ExpandSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        d="M8 5.5v13M12 8l3.5 4L12 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RolesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M12 3.5 5.5 6.2v5.2c0 4.3 3.1 8.4 6.5 9.4 3.4-1 6.5-5.1 6.5-9.4V6.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1 11 13.9l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M8 4.5h8A2.5 2.5 0 0 1 18.5 7v12A2.5 2.5 0 0 1 16 21.5H8A2.5 2.5 0 0 1 5.5 19V7A2.5 2.5 0 0 1 8 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M9 9.5h6M9 13h6M9 16.5h3.5M8.3 3.2 10.1 5l2.4-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M12 4.5a7.5 7.5 0 0 0-7.5 7.5v3.2A2.3 2.3 0 0 0 6.8 17.5h.9V12a4.3 4.3 0 1 1 8.6 0v5.5h.9a2.3 2.3 0 0 0 2.3-2.3V12A7.5 7.5 0 0 0 12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 17.8v.7A2.5 2.5 0 0 0 12 21a2.5 2.5 0 0 0 2.5-2.5v-.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CargosIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M8.5 7.2V6.2A2.7 2.7 0 0 1 11.2 3.5h1.6A2.7 2.7 0 0 1 15.5 6.2v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M5 9.2h14A1.5 1.5 0 0 1 20.5 10.7v8.3A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V10.7A1.5 1.5 0 0 1 5 9.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 13.2h16.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LocalidadesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M5.5 19.5V8.2L12 4.5l6.5 3.7v11.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 19.5v-5.2h6v5.2M9 10.2h.01M12 10.2h.01M15 10.2h.01M9 13.2h.01M15 13.2h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function navIcon(key: AppMenuKey) {
  switch (key) {
    case AppMenuKey.Inicio:
      return <HomeIcon />
    case AppMenuKey.Estaciones:
      return <StationIcon />
    case AppMenuKey.Personal:
      return <StaffIcon />
    case AppMenuKey.Cargos:
      return <CargosIcon />
    case AppMenuKey.Localidades:
      return <LocalidadesIcon />
    case AppMenuKey.Roles:
      return <RolesIcon />
    case AppMenuKey.Areas:
      return <AreasIcon />
    case AppMenuKey.Tareas:
      return <TasksIcon />
    case AppMenuKey.Asistencias:
      return <AttendanceIcon />
    case AppMenuKey.Mapa:
      return <MapIcon />
    case AppMenuKey.Usuarios:
      return <UsersIcon />
    case AppMenuKey.AppMovil:
      return <PhoneIcon />
    case AppMenuKey.Soporte:
      return <SupportIcon />
    default:
      return null
  }
}

function readCollapsedPreference(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
}

export function AdminLayout() {
  const { user, setUser } = useAuth()
  const { canAccessMenu } = usePermissions()
  const { logoutUseCase, updateOwnThemeUseCase } = useDependencies()
  const navigate = useNavigate()
  const location = useLocation()
  const [themeBusy, setThemeBusy] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedPreference)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    document.documentElement.classList.add('admin-locked')
    document.body.classList.add('admin-locked')
    return () => {
      document.documentElement.classList.remove('admin-locked')
      document.body.classList.remove('admin-locked')
    }
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    document.documentElement.classList.add('admin-mobile-nav-open')
    document.body.classList.add('admin-mobile-nav-open')
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.documentElement.classList.remove('admin-mobile-nav-open')
      document.body.classList.remove('admin-mobile-nav-open')
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  if (!user) return null

  async function handleLogout() {
    await logoutUseCase.execute()
    setUser(null)
    navigate('/login', { replace: true })
  }

  async function handleToggleTheme() {
    if (!user || themeBusy) return

    const previousUser = user
    const nextTheme =
      user.theme === ThemePreference.Dark
        ? ThemePreference.Light
        : ThemePreference.Dark

    document.documentElement.setAttribute('data-theme', nextTheme)
    setUser({ ...user, theme: nextTheme })
    setThemeBusy(true)

    try {
      const updated = await updateOwnThemeUseCase.execute(previousUser, nextTheme)
      setUser(updated)
    } catch {
      document.documentElement.setAttribute('data-theme', previousUser.theme)
      setUser(previousUser)
    } finally {
      setThemeBusy(false)
    }
  }

  function handleToggleSidebar() {
    setSidebarCollapsed((current) => !current)
  }

  const initials = user.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const isDark = user.theme === ThemePreference.Dark
  const menuByKey = new Map(
    APP_MENU_DEFINITIONS.map((item) => [item.key, item]),
  )
  const menuModules = APP_MENU_MODULES.map((mod) => ({
    ...mod,
    items: mod.keys
      .map((key) => menuByKey.get(key))
      .filter(
        (item): item is (typeof APP_MENU_DEFINITIONS)[number] =>
          item != null && canAccessMenu(item.key),
      ),
  })).filter((mod) => mod.items.length > 0)

  const shellClassName = [
    'admin-shell',
    sidebarCollapsed ? 'admin-shell--collapsed' : '',
    mobileMenuOpen ? 'admin-shell--mobile-nav-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClassName}>
      {mobileMenuOpen ? (
        <button
          type="button"
          className="admin-mobile-backdrop"
          aria-label="Cerrar menú de navegación"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div className="admin-sticky-stack">
        <aside className="admin-sidebar" aria-label="Barra lateral">
          <div className="admin-sidebar__brand">
            <img src={logo} alt="" className="admin-sidebar__logo" />
            <div className="admin-sidebar__brand-text">
              <strong>Consorcio Selva MDD</strong>
              <span>
                {user.role === UserRole.SuperAdministrador
                  ? 'Panel Super Administrador'
                  : 'Panel Administrador'}
              </span>
            </div>
            <button
              type="button"
              className="admin-sidebar__close"
              aria-label="Cerrar menú"
              onClick={() => setMobileMenuOpen(false)}
            >
              <CloseMenuIcon />
            </button>
          </div>

          <div className="admin-sidebar__section">
            <nav
              id="admin-primary-nav"
              className="admin-nav-modules"
              aria-label="Navegación principal"
            >
              {menuModules.map((mod) => (
                <div key={mod.id} className="admin-nav-module">
                  {mod.label ? (
                    <p className="admin-sidebar__label">{mod.label}</p>
                  ) : null}
                  <div className="admin-nav">
                    {mod.items.map((item) => (
                      <NavLink
                        key={item.key}
                        to={item.path}
                        end={
                          item.key === AppMenuKey.Personal ||
                          item.key === AppMenuKey.Inicio
                        }
                        title={item.label}
                        data-label={item.label}
                        className={({ isActive }) =>
                          isActive ? 'admin-nav__link active' : 'admin-nav__link'
                        }
                      >
                        {navIcon(item.key)}
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="admin-sidebar__footer">
            <div
              className="admin-sidebar__user"
              title={`${user.displayName} · ${userRoleLabel(user.role)}`}
              data-label={`${user.displayName} · ${userRoleLabel(user.role)}`}
            >
              <div className="admin-sidebar__avatar" aria-hidden="true">
                {initials || 'U'}
              </div>
              <div className="admin-sidebar__user-meta">
                <strong>{user.displayName}</strong>
                <span>{userRoleLabel(user.role)}</span>
              </div>
            </div>
            <button
              type="button"
              className="admin-sidebar__collapse"
              onClick={handleToggleSidebar}
              title={sidebarCollapsed ? 'Expandir menú' : 'Arrinconar menú'}
              aria-label={sidebarCollapsed ? 'Expandir menú' : 'Arrinconar menú'}
              aria-pressed={sidebarCollapsed}
              data-label={sidebarCollapsed ? 'Expandir menú' : 'Arrinconar menú'}
            >
              {sidebarCollapsed ? <ExpandSidebarIcon /> : <CollapseSidebarIcon />}
              <span>{sidebarCollapsed ? 'Expandir menú' : 'Arrinconar menú'}</span>
            </button>
          </div>
        </aside>

        <header className="admin-topbar">
          <div className="admin-topbar__identity">
            <button
              type="button"
              className="theme-btn admin-topbar__menu-toggle"
              onClick={() => setMobileMenuOpen((open) => !open)}
              title={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-primary-nav"
            >
              {mobileMenuOpen ? <CloseMenuIcon /> : <HamburgerIcon />}
            </button>
            <button
              type="button"
              className="theme-btn admin-topbar__sidebar-toggle"
              onClick={handleToggleSidebar}
              title={
                sidebarCollapsed
                  ? 'Expandir menú'
                  : 'Arrinconar menú'
              }
              aria-label={
                sidebarCollapsed
                  ? 'Expandir menú'
                  : 'Arrinconar menú'
              }
              aria-pressed={sidebarCollapsed}
            >
              {sidebarCollapsed ? <ExpandSidebarIcon /> : <CollapseSidebarIcon />}
            </button>
            <img src={logo} alt="" className="admin-topbar__logo" />
            <div>
              <p className="admin-topbar__eyebrow">
                {user.role === UserRole.SuperAdministrador
                  ? 'Super Administrador'
                  : 'Administrador'}
              </p>
              <h1>Consorcio Selva MDD</h1>
            </div>
          </div>
          <div className="admin-topbar__actions">
            <div className="admin-topbar__user-chip" title={user.displayName}>
              <span className="admin-topbar__avatar" aria-hidden="true">
                {initials || 'U'}
              </span>
              <span className="admin-topbar__user-name">{user.displayName}</span>
            </div>
            <button
              type="button"
              className="theme-btn"
              disabled={themeBusy}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={
                isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
              }
              onClick={() => void handleToggleTheme()}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="admin-topbar__logout-btn"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={() => void handleLogout()}
            >
              <LogoutIcon />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>
      </div>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}
