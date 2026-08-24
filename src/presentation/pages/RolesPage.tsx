import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { PersonalOrgNav } from '@/presentation/components/PersonalOrgNav'
import type { OperationalRole } from '@/domain/entities/OperationalRole'
import {
  APP_MENU_DEFINITIONS,
  APP_MENU_MODULES,
  type AppMenuKey,
} from '@/domain/value-objects/AppMenuPermission'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './RolesPage.css'

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="roles-card__icon">
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5zm0 10.99h6c-.53 4.12-3.28 7.79-6 8.94V13H6V6.3l6-2.25z"
      />
    </svg>
  )
}

export function RolesPage() {
  const { user } = useAuth()
  const { canManageRoles, refreshPermissions } = usePermissions()
  const {
    listOperationalRolesUseCase,
    createOperationalRoleUseCase,
    updateOperationalRoleUseCase,
    deleteOperationalRoleUseCase,
  } = useDependencies()

  const [roles, setRoles] = useState<OperationalRole[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [activitiesOpen, setActivitiesOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalRole | null>(null)
  const [viewing, setViewing] = useState<OperationalRole | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [permissions, setPermissions] = useState<AppMenuKey[]>([])

  const groupedMenus = useMemo(() => {
    return APP_MENU_MODULES.map((mod) => {
      const items = APP_MENU_DEFINITIONS.filter((item) => item.module === mod.id)
      return [mod.label, items] as const
    }).filter(([, items]) => items.length > 0)
  }, [])

  async function loadRoles() {
    if (!user) return
    setLoading(true)
    try {
      setRoles(await listOperationalRolesUseCase.execute(user))
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudieron cargar los roles',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function openCreate() {
    setEditing(null)
    setName('')
    setCode('')
    setPermissions([])
    setModalOpen(true)
  }

  function openEdit(role: OperationalRole) {
    setEditing(role)
    setName(role.name)
    setCode(role.code)
    setPermissions(role.permissions)
    setModalOpen(true)
  }

  function openActivities(role: OperationalRole) {
    setViewing(role)
    setActivitiesOpen(true)
  }

  function togglePermission(key: AppMenuKey) {
    setPermissions((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    )
  }

  async function confirmDelete(role: OperationalRole) {
    if (!user || !canManageRoles || role.isSystem) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar rol?',
      text: `"${role.name}" se quitará del catálogo.`,
    })
    if (!confirmed) return

    setRoles((current) => current.filter((item) => item.id !== role.id))
    swalSuccess('Rol eliminado')
    try {
      await deleteOperationalRoleUseCase.execute(user, role.id)
      await refreshPermissions()
    } catch (err) {
      setRoles((current) =>
        [...current, role].sort((left, right) =>
          left.name.localeCompare(right.name, 'es'),
        ),
      )
      swalError(err instanceof DomainError ? err.message : 'No se pudo eliminar')
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || !canManageRoles) return

    if (editing) {
      const previous = editing
      const optimistic: OperationalRole = {
        ...previous,
        name: name.trim(),
        permissions,
        updatedAt: new Date(),
      }
      setRoles((current) =>
        current
          .map((item) => (item.id === previous.id ? optimistic : item))
          .sort((left, right) => left.name.localeCompare(right.name, 'es')),
      )
      setModalOpen(false)
      swalSuccess('Rol actualizado')
      void updateOperationalRoleUseCase
        .execute(user, previous.id, {
          name,
          permissions,
        })
        .then(async (updated) => {
          setRoles((current) =>
            current
              .map((item) => (item.id === updated.id ? updated : item))
              .sort((left, right) => left.name.localeCompare(right.name, 'es')),
          )
          await refreshPermissions()
        })
        .catch((err: unknown) => {
          setRoles((current) =>
            current
              .map((item) => (item.id === previous.id ? previous : item))
              .sort((left, right) => left.name.localeCompare(right.name, 'es')),
          )
          setEditing(previous)
          setName(previous.name)
          setPermissions(previous.permissions)
          setModalOpen(true)
          swalError(
            err instanceof DomainError ? err.message : 'No se pudo guardar',
          )
        })
      return
    }

    const tempId = `temp:${crypto.randomUUID()}`
    const trimmedName = name.trim()
    const trimmedCode = code.trim().toUpperCase()
    const optimistic: OperationalRole = {
      id: tempId,
      name: trimmedName,
      code: trimmedCode,
      permissions,
      isSystem: false,
      createdById: user.id,
      createdByName: user.displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setRoles((current) =>
      [...current, optimistic].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
      ),
    )
    setModalOpen(false)
    swalSuccess('Rol creado')
    void createOperationalRoleUseCase
      .execute(user, {
        name: trimmedName,
        code: trimmedCode,
        permissions,
      })
      .then(async (created) => {
        setRoles((current) =>
          current
            .map((item) => (item.id === tempId ? created : item))
            .sort((left, right) => left.name.localeCompare(right.name, 'es')),
        )
        await refreshPermissions()
      })
      .catch((err: unknown) => {
        setRoles((current) => current.filter((item) => item.id !== tempId))
        setEditing(null)
        setName(trimmedName)
        setCode(trimmedCode)
        setPermissions(permissions)
        setModalOpen(true)
        swalError(err instanceof DomainError ? err.message : 'No se pudo guardar')
      })
  }

  if (!user) return null

  return (
    <section className="roles-page">
      <header className="page-header">
        <div>
          <p className="roles-page__eyebrow">Organización</p>
          <h1>Roles y permisos</h1>
          <p>
            Define qué menús y actividades ve cada rol: Super Administrador,
            Administrador y Técnico.
          </p>
        </div>
        <div className="roles-page__actions">
          <PersonalOrgNav />
          {canManageRoles ? (
            <button type="button" className="btn btn--soft-primary" onClick={openCreate}>
              <IconPlus />
              Nuevo rol
            </button>
          ) : null}
        </div>
      </header>

      {loading ? (
        <p className="roles-empty">Cargando roles…</p>
      ) : roles.length === 0 ? (
        <div className="roles-empty">
          <h2>Sin roles configurados</h2>
          <p>
            El Super Administrador puede crear los roles base o importar personal
            después de inicializarlos.
          </p>
        </div>
      ) : (
        <div className="roles-grid">
          {roles.map((role) => (
            <article key={role.id} className="roles-card">
              <div className="roles-card__top">
                <span className="roles-card__glyph" aria-hidden="true">
                  <IconShield />
                </span>
                {role.isSystem ? (
                  <span className="roles-card__badge">Sistema</span>
                ) : null}
              </div>
              <h2>{role.name}</h2>
              <p className="roles-card__code">{role.code}</p>
              <p className="roles-card__meta">
                {role.permissions.length} menú
                {role.permissions.length === 1 ? '' : 's'} activo
                {role.permissions.length === 1 ? '' : 's'}
              </p>
              <div className="roles-card__actions">
                <button
                  type="button"
                  className="btn btn--soft-muted btn--small"
                  onClick={() => openActivities(role)}
                >
                  Ver actividades
                </button>
                {canManageRoles ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--soft-blue btn--small"
                      onClick={() => openEdit(role)}
                    >
                      Editar
                    </button>
                    {!role.isSystem ? (
                      <button
                        type="button"
                        className="btn btn--soft-rose btn--small"
                        onClick={() => void confirmDelete(role)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? 'Editar rol' : 'Nuevo rol'}
        description="Marca los menús que este rol puede usar en el panel."
        size="md"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" form="roles-form" className="btn btn--soft-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="roles-form" className="roles-form" onSubmit={handleSave}>
          <label className="field">
            <span>Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </label>
          {!editing ? (
            <label className="field">
              <span>Código</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="EJ. SUPERVISOR_CAMPO"
                required
                maxLength={40}
              />
            </label>
          ) : (
            <p className="roles-form__hint">Código: {editing.code}</p>
          )}
          <div className="roles-permissions">
            {groupedMenus.map(([group, items]) => (
              <div key={group} className="roles-permissions__group">
                <h3>{group}</h3>
                <div className="roles-permissions__list">
                  {items.map((item) => (
                    <label key={item.key} className="roles-permissions__item">
                      <input
                        type="checkbox"
                        checked={permissions.includes(item.key)}
                        onChange={() => togglePermission(item.key)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </form>
      </AppModal>

      <AppModal
        open={activitiesOpen}
        title={viewing ? `Actividades · ${viewing.name}` : 'Actividades'}
        description="Menús y secciones habilitadas para este rol."
        size="md"
        onClose={() => setActivitiesOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={() => setActivitiesOpen(false)}
          >
            Cerrar
          </button>
        }
      >
        {viewing ? (
          <div className="roles-activities">
            {groupedMenus.map(([group, items]) => {
              const active = items.filter((item) =>
                viewing.permissions.includes(item.key),
              )
              if (active.length === 0) return null
              return (
                <div key={group} className="roles-activities__group">
                  <h3>{group}</h3>
                  <ul>
                    {active.map((item) => (
                      <li key={item.key}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : null}
      </AppModal>
    </section>
  )
}
