import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { UserRole, userRoleLabel } from '@/domain/value-objects/UserRole'
import { ThemePreference } from '@/domain/value-objects/ThemePreference'
import './AdminLayout.css'

const SIDEBAR_COLLAPSED_KEY = 'consorcio-sidebar-collapsed'

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

function DocsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        transform="translate(-0.5 0)"
      />
      <path
        d="M14 3.5V8h5M9 12h6M9 15.5h6M9 19h4"
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

function CollapseSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        fill="currentColor"
        d="M14 7l-5 5 5 5V7zm7-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H3V5h18z"
      />
    </svg>
  )
}

function ExpandSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-btn__icon">
      <path
        fill="currentColor"
        d="M10 17l5-5-5-5v10zm9-14H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14z"
      />
    </svg>
  )
}

function readCollapsedPreference(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
}

export function AdminLayout() {
  const { user, setUser } = useAuth()
  const { logoutUseCase, updateOwnThemeUseCase } = useDependencies()
  const navigate = useNavigate()
  const [themeBusy, setThemeBusy] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedPreference)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

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

  return (
    <div
      className={`admin-shell ${sidebarCollapsed ? 'admin-shell--collapsed' : ''}`}
    >
      <div className="admin-sticky-stack">
        <aside className="admin-sidebar" aria-label="Barra lateral">
          <div className="admin-sidebar__brand">
            <img src={logo} alt="" className="admin-sidebar__logo" />
            <div className="admin-sidebar__brand-text">
              <strong>Consorcio Selva MDD</strong>
              <span>Panel administrativo</span>
            </div>
          </div>

          <div className="admin-sidebar__section">
            <p className="admin-sidebar__label">Menú</p>
            <nav className="admin-nav" aria-label="Navegación principal">
              <NavLink
                to="/areas"
                title="Áreas"
                className={({ isActive }) =>
                  isActive ? 'admin-nav__link active' : 'admin-nav__link'
                }
              >
                <AreasIcon />
                <span>Áreas</span>
              </NavLink>
              <NavLink
                to="/mapa"
                title="Mapa"
                className={({ isActive }) =>
                  isActive ? 'admin-nav__link active' : 'admin-nav__link'
                }
              >
                <MapIcon />
                <span>Mapa</span>
              </NavLink>
              <NavLink
                to="/documentacion"
                title="Documentación"
                className={({ isActive }) =>
                  isActive ? 'admin-nav__link active' : 'admin-nav__link'
                }
              >
                <DocsIcon />
                <span>Documentación</span>
              </NavLink>
              {user.role === UserRole.Administrador ? (
                <NavLink
                  to="/usuarios"
                  title="Usuarios"
                  className={({ isActive }) =>
                    isActive ? 'admin-nav__link active' : 'admin-nav__link'
                  }
                >
                  <UsersIcon />
                  <span>Usuarios</span>
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className="admin-sidebar__footer">
            <div className="admin-sidebar__user">
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
              title={
                sidebarCollapsed
                  ? 'Expandir barra lateral'
                  : 'Arrinconar barra lateral'
              }
              aria-label={
                sidebarCollapsed
                  ? 'Expandir barra lateral'
                  : 'Arrinconar barra lateral'
              }
              aria-pressed={sidebarCollapsed}
            >
              {sidebarCollapsed ? <ExpandSidebarIcon /> : <CollapseSidebarIcon />}
              <span>
                {sidebarCollapsed ? 'Expandir menú' : 'Arrinconar menú'}
              </span>
            </button>
          </div>
        </aside>

        <header className="admin-topbar">
          <div className="admin-topbar__identity">
            <button
              type="button"
              className="theme-btn admin-topbar__sidebar-toggle"
              onClick={handleToggleSidebar}
              title={
                sidebarCollapsed
                  ? 'Expandir barra lateral'
                  : 'Arrinconar barra lateral'
              }
              aria-label={
                sidebarCollapsed
                  ? 'Expandir barra lateral'
                  : 'Arrinconar barra lateral'
              }
              aria-pressed={sidebarCollapsed}
            >
              {sidebarCollapsed ? <ExpandSidebarIcon /> : <CollapseSidebarIcon />}
            </button>
            <img src={logo} alt="" className="admin-topbar__logo" />
            <div>
              <p className="admin-topbar__eyebrow">Gestión operativa</p>
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
            <div className="admin-topbar__badge">{userRoleLabel(user.role)}</div>
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
