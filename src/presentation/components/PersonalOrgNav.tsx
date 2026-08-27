import { NavLink } from 'react-router-dom'
import { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'
import './OrgModuleNav.css'

const LINKS = [
  {
    key: AppMenuKey.Personal,
    label: 'Recursos Humanos',
    path: '/recursos-humanos',
  },
  { key: AppMenuKey.Cargos, label: 'Cargos', path: '/cargos' },
  { key: AppMenuKey.Localidades, label: 'Localidades', path: '/localidades' },
] as const

export function PersonalOrgNav() {
  const { canAccessMenu } = usePermissions()

  const visible = LINKS.filter((item) => canAccessMenu(item.key))
  if (visible.length === 0) return null

  return (
    <nav className="org-module-nav" aria-label="Recursos Humanos">
      {visible.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/recursos-humanos'}
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
