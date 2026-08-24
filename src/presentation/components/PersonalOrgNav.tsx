import { NavLink } from 'react-router-dom'
import { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'

const LINKS = [
  { key: AppMenuKey.Personal, label: 'Personal', path: '/personal' },
  { key: AppMenuKey.Roles, label: 'Roles', path: '/personal/roles' },
  { key: AppMenuKey.Cargos, label: 'Cargos', path: '/cargos' },
  { key: AppMenuKey.Localidades, label: 'Localidades', path: '/localidades' },
] as const

export function PersonalOrgNav() {
  const { canAccessMenu } = usePermissions()

  const visible = LINKS.filter((item) => canAccessMenu(item.key))
  if (visible.length === 0) return null

  return (
    <nav className="personal-page__subnav" aria-label="Organización">
      {visible.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/personal'}
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
