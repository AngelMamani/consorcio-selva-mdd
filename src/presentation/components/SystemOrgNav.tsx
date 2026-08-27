import { NavLink } from 'react-router-dom'
import { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'
import './OrgModuleNav.css'

const LINKS = [
  { key: AppMenuKey.Roles, label: 'Roles', path: '/roles' },
  { key: AppMenuKey.Usuarios, label: 'Cuentas', path: '/usuarios' },
  { key: AppMenuKey.AppMovil, label: 'App móvil', path: '/app-movil' },
  { key: AppMenuKey.Soporte, label: 'Soporte', path: '/soporte' },
] as const

export function SystemOrgNav() {
  const { canAccessMenu } = usePermissions()

  const visible = LINKS.filter((item) => canAccessMenu(item.key))
  if (visible.length === 0) return null

  return (
    <nav className="org-module-nav" aria-label="Sistema">
      {visible.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `btn btn--soft-muted${isActive ? ' is-active' : ''}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
