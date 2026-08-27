import { useEffect, useMemo, useState } from 'react'
import type { User } from '@/domain/entities/User'
import {
  uniqueUsersByAccessDni,
  userAccessDni,
} from '@/domain/entities/User'
import type { Personal } from '@/domain/entities/Personal'
import { personalFullName, personalRoleIds } from '@/domain/entities/Personal'
import {
  ALL_USER_ROLES,
  assignedUserRoles,
  hasAssignedRole,
  mobileAccessRoles,
  UserRole,
  userRoleLabel,
  webAccessRoles,
} from '@/domain/value-objects/UserRole'
import { isTechnicianSyntheticEmail } from '@/domain/value-objects/TechnicianLogin'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { SystemOrgNav } from '@/presentation/components/SystemOrgNav'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirm,
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './UsersPage.css'

type AccountRow = User & {
  cargoName: string
  localidadName: string
  condicion: string
  hrLinked: boolean
}

function overlayHr(users: User[], people: Personal[]): AccountRow[] {
  const unique = uniqueUsersByAccessDni(users)
  const byDni = new Map<string, User>()
  for (const item of unique) {
    const dni = userAccessDni(item)
    if (dni) byDni.set(dni, item)
  }

  const usedIds = new Set<string>()
  const rows: AccountRow[] = []

  for (const person of people) {
    if (!/^\d{8}$/.test(person.dni)) continue
    if (person.condicion === 'RETIRADO') continue
    if (personalRoleIds(person).length === 0) continue
    const account = byDni.get(person.dni)
    if (!account) continue
    usedIds.add(account.id)
    rows.push({
      ...account,
      displayName: personalFullName(person) || account.displayName,
      cargoName: person.cargoName,
      localidadName: person.localidadName,
      condicion: person.condicion,
      hrLinked: true,
    })
  }

  for (const item of unique) {
    if (usedIds.has(item.id)) continue
    if (userAccessDni(item)) continue
    rows.push({
      ...item,
      cargoName: '',
      localidadName: '',
      condicion: '',
      hrLinked: false,
    })
  }

  return rows
}

function hrMetaLabel(item: AccountRow): string {
  const parts = [item.cargoName, item.localidadName].filter(Boolean)
  if (item.condicion === 'RETIRADO') parts.push('Retirado')
  if (!item.hrLinked) parts.push('Sin ficha en RR.HH.')
  return parts.join(' · ')
}

function withAccountUser(row: AccountRow, next: User): AccountRow {
  return {
    ...row,
    ...next,
    cargoName: row.cargoName,
    localidadName: row.localidadName,
    condicion: row.condicion,
    hrLinked: row.hrLinked,
  }
}

function userAccessLabel(item: User): string {
  const parts: string[] = []
  if (/^\d{8}$/.test(item.dni)) parts.push(`DNI ${item.dni}`)
  if (item.email && !isTechnicianSyntheticEmail(item.email)) {
    parts.push(item.email)
  }
  if (parts.length === 0) return item.email || item.dni || '—'
  return parts.join(' · ')
}

function accountPlatformLabel(item: User): string {
  const web = webAccessRoles(item).length > 0
  const mobile = mobileAccessRoles(item).length > 0
  if (web && mobile) return 'Web y app'
  if (web) return 'Solo web'
  if (mobile) return 'Solo app'
  return 'Sin acceso'
}

function roleChipClass(role: UserRole): string {
  if (role === UserRole.SuperAdministrador) return ' users-role-chip--super'
  if (role === UserRole.Administrador) return ' users-role-chip--admin'
  return ' users-role-chip--tech'
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M6 19h4V5H6zm8-14v14h4V5z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2"
      />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3.5-9h1v8h-1zm4 0h1v8h-1zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="users-search__icon">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
      />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="users-empty__icon">
      <path
        fill="currentColor"
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3m-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3m0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5m8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5"
      />
    </svg>
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function avatarTone(name: string): string {
  const tones = ['teal', 'blue', 'green', 'amber', 'indigo']
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % tones.length
  }
  return tones[hash]
}

export function UsersPage() {
  const { user } = useAuth()
  const {
    updateUserUseCase,
    resetUserPasswordUseCase,
    deleteUserUseCase,
    syncHrAccountsUseCase,
  } = useDependencies()
  const [users, setUsers] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'all',
  )
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [credentialsInfo, setCredentialsInfo] = useState<{
    title: string
    displayName: string
    access: string
    temporaryPassword: string
  } | null>(null)

  async function loadUsers() {
    if (!user) return
    setLoading(true)
    try {
      const result = await syncHrAccountsUseCase.execute(user)
      setUsers(overlayHr(result.users, result.people))
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'Error al cargar las cuentas',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return users
      .filter((item) => {
        if (statusFilter === 'active' && !item.active) return false
        if (statusFilter === 'inactive' && item.active) return false
        if (roleFilter !== 'all' && !hasAssignedRole(item, roleFilter)) {
          return false
        }
        if (!query) return true
        return (
          item.displayName.toLowerCase().includes(query) ||
          item.dni.includes(query) ||
          item.email.toLowerCase().includes(query) ||
          item.cargoName.toLowerCase().includes(query) ||
          item.localidadName.toLowerCase().includes(query)
        )
      })
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, 'es'),
      )
  }, [users, searchTerm, statusFilter, roleFilter])

  const activeCount = users.filter((item) => item.active).length
  const inactiveCount = users.length - activeCount
  const busy = resettingUserId !== null || deletingUserId !== null

  async function handleToggleActive(target: AccountRow) {
    if (!user || busy) return
    if (target.id === user.id) {
      swalError('No puedes desactivar tu propia cuenta')
      return
    }
    const nextActive = !target.active
    if (!nextActive) {
      const confirmed = await swalConfirm({
        title: '¿Desactivar cuenta?',
        text: `${target.displayName} no podrá entrar a la página web ni al aplicativo móvil hasta que la actives de nuevo.`,
        confirmButtonText: 'Sí, desactivar',
        confirmButtonColor: '#c62828',
      })
      if (!confirmed) return
    }

    const previous = target
    setUsers((current) =>
      current.map((item) =>
        item.id === target.id
          ? { ...item, active: nextActive, updatedAt: new Date() }
          : item,
      ),
    )

    try {
      const updated = await updateUserUseCase.execute(user, {
        userId: target.id,
        active: nextActive,
      })
      setUsers((current) =>
        current.map((item) =>
          item.id === updated.id ? withAccountUser(item, updated) : item,
        ),
      )
      swalSuccess(
        nextActive
          ? `${target.displayName} activado`
          : `${target.displayName} desactivado`,
      )
    } catch (err) {
      setUsers((current) =>
        current.map((item) => (item.id === previous.id ? previous : item)),
      )
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo actualizar',
      )
    }
  }

  async function handleResetPassword(target: AccountRow) {
    if (!user || busy) return
    if (target.id === user.id) {
      swalError('No puedes restablecer tu propia contraseña desde aquí')
      return
    }

    const confirmed = await swalConfirm({
      title: '¿Restablecer clave?',
      text: `Se asignará 87654321 a ${target.displayName}. Al entrar a la página web o al aplicativo móvil deberá cambiarla.`,
      confirmButtonText: 'Sí, restablecer',
      confirmButtonColor: '#f9a825',
    })
    if (!confirmed) return

    setResettingUserId(target.id)
    try {
      const result = await resetUserPasswordUseCase.execute(user, target.id)
      setUsers((current) =>
        current.map((item) =>
          item.id === result.user.id
            ? withAccountUser(item, result.user)
            : item,
        ),
      )
      setCredentialsInfo({
        title: 'Clave restablecida',
        displayName: target.displayName,
        access: userAccessLabel(target),
        temporaryPassword: result.temporaryPassword,
      })
      swalSuccess('Clave restablecida')
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo restablecer la contraseña',
      )
    } finally {
      setResettingUserId(null)
    }
  }

  async function handleDelete(target: AccountRow) {
    if (!user || busy) return
    if (target.id === user.id) {
      swalError('No puedes eliminar tu propia cuenta')
      return
    }

    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar cuenta?',
      text: `Se quitará el acceso de ${target.displayName} a la página web y al aplicativo. La ficha queda en Recursos Humanos sin roles.`,
    })
    if (!confirmed) return

    setDeletingUserId(target.id)
    try {
      await deleteUserUseCase.execute(user, target.id)
      setUsers((current) => current.filter((item) => item.id !== target.id))
      swalSuccess('Cuenta eliminada')
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo eliminar la cuenta',
      )
    } finally {
      setDeletingUserId(null)
    }
  }

  async function copyTemporaryPassword() {
    if (!credentialsInfo) return
    try {
      await navigator.clipboard.writeText(credentialsInfo.temporaryPassword)
      swalSuccess('Clave copiada')
    } catch {
      swalError('No se pudo copiar. Selecciónala manualmente.')
    }
  }

  function renderActions(item: AccountRow) {
    const isSelf = item.id === user?.id
    const toggleLabel = item.active ? 'Desactivar' : 'Activar'
    const resetLabel =
      resettingUserId === item.id ? 'Restableciendo...' : 'Restablecer clave'
    const deleteLabel =
      deletingUserId === item.id ? 'Eliminando...' : 'Eliminar cuenta'

    return (
      <div className="user-card__actions" role="group" aria-label="Acciones">
        <button
          type="button"
          className={`btn btn--icon-only ${
            item.active ? 'btn--soft-rose' : 'btn--soft-teal'
          }`}
          onClick={() => void handleToggleActive(item)}
          disabled={busy || isSelf}
          title={isSelf ? 'No puedes desactivar tu cuenta' : toggleLabel}
          aria-label={toggleLabel}
        >
          {item.active ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          className="btn btn--icon-only btn--soft-amber"
          onClick={() => void handleResetPassword(item)}
          disabled={busy || isSelf}
          title={isSelf ? 'No puedes restablecer tu clave aquí' : resetLabel}
          aria-label={resetLabel}
        >
          <IconKey />
        </button>
        <button
          type="button"
          className="btn btn--icon-only btn--soft-rose"
          onClick={() => void handleDelete(item)}
          disabled={busy || isSelf}
          title={isSelf ? 'No puedes eliminar tu cuenta' : deleteLabel}
          aria-label={deleteLabel}
        >
          <IconTrash />
        </button>
      </div>
    )
  }

  let content
  if (loading) {
    content = (
      <div className="users-empty">
        <div className="users-empty__spinner" />
        <p>Cargando cuentas...</p>
      </div>
    )
  } else if (users.length === 0) {
    content = (
      <div className="users-empty">
        <IconPeople />
        <h3>Sin cuentas</h3>
        <p>
          Las cuentas se crean al asignar roles en Recursos Humanos. Hay una
          sola cuenta por persona; esta lista se sincroniza con esas fichas.
        </p>
      </div>
    )
  } else if (filteredUsers.length === 0) {
    content = (
      <div className="users-empty">
        <IconSearch />
        <h3>Sin resultados</h3>
        <p>No hay coincidencias con el filtro actual.</p>
        <button
          type="button"
          className="btn btn--soft-blue btn--small"
          onClick={() => {
            setSearchTerm('')
            setStatusFilter('all')
            setRoleFilter('all')
          }}
        >
          Ver todas las cuentas
        </button>
      </div>
    )
  } else {
    content = (
      <div className="users-list-panel">
        <div className="table-wrap users-list-desktop">
          <table className="data-table users-list-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Acceso</th>
                <th>Roles</th>
                <th>Plataforma</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((item) => (
                <tr
                  key={item.id}
                  className={item.active ? '' : 'users-list-row--inactive'}
                >
                  <td>
                    <div className="users-list-name-cell">
                      <div
                        className={`user-avatar user-avatar--sm user-avatar--${avatarTone(item.displayName)}`}
                        aria-hidden="true"
                      >
                        {getInitials(item.displayName)}
                      </div>
                      <div className="users-list-name-copy">
                        <strong>{item.displayName}</strong>
                        {hrMetaLabel(item) ? (
                          <span className="users-list-hr-meta">
                            {hrMetaLabel(item)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                      <td>
                        <span className="users-list-email">
                          {userAccessLabel(item)}
                        </span>
                      </td>
                      <td>
                        <div className="users-role-chips">
                          {assignedUserRoles(item).map((role) => (
                            <span
                              key={role}
                              className={`users-role-chip${roleChipClass(role)}`}
                            >
                              {userRoleLabel(role)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{accountPlatformLabel(item)}</td>
                      <td>
                    <span
                      className={`status-pill ${
                        item.active
                          ? 'status-pill--active'
                          : 'status-pill--inactive'
                      }`}
                    >
                      {item.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{renderActions(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="users-list-mobile">
          {filteredUsers.map((item) => (
            <article
              key={item.id}
              className={`users-list-item ${
                item.active ? '' : 'users-list-item--inactive'
              }`}
            >
              <div className="users-list-item__main">
                <div
                  className={`user-avatar user-avatar--sm user-avatar--${avatarTone(item.displayName)}`}
                  aria-hidden="true"
                >
                  {getInitials(item.displayName)}
                </div>
                <div className="users-list-item__copy">
                  <strong>{item.displayName}</strong>
                  {hrMetaLabel(item) ? <p>{hrMetaLabel(item)}</p> : null}
                  <p>{userAccessLabel(item)}</p>
                  <p className="users-list-item__platform">
                    {accountPlatformLabel(item)}
                  </p>
                </div>
                {renderActions(item)}
              </div>
              <div className="users-list-item__tags">
                <span
                  className={`status-pill ${
                    item.active ? 'status-pill--active' : 'status-pill--inactive'
                  }`}
                >
                  {item.active ? 'Activo' : 'Inactivo'}
                </span>
                {assignedUserRoles(item).map((role) => (
                  <span
                    key={role}
                    className={`users-role-chip${roleChipClass(role)}`}
                  >
                    {userRoleLabel(role)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="users-page">
      <div className="page-header">
        <div>
          <p className="users-page__eyebrow">Sistema</p>
          <h2>Cuentas</h2>
          <p>
            Las personas se registran en Recursos Humanos. Aquí hay una sola
            cuenta de acceso por DNI, sincronizada con esa ficha. Al eliminar
            una cuenta se quita el acceso y los roles de la ficha.
          </p>
        </div>
        <SystemOrgNav />
      </div>

      <div className="users-summary" aria-label="Resumen de cuentas">
        <div className="users-summary__item users-summary__item--tech">
          <span className="users-summary__icon" aria-hidden="true">
            <IconPeople />
          </span>
          <div>
            <strong>{users.length}</strong>
            <span>cuentas</span>
          </div>
        </div>
        <div className="users-summary__item users-summary__item--active">
          <span className="users-summary__icon" aria-hidden="true">
            <IconPlay />
          </span>
          <div>
            <strong>{activeCount}</strong>
            <span>activas</span>
          </div>
        </div>
        <div className="users-summary__item users-summary__item--inactive">
          <span className="users-summary__icon" aria-hidden="true">
            <IconPause />
          </span>
          <div>
            <strong>{inactiveCount}</strong>
            <span>inactivas</span>
          </div>
        </div>
      </div>

      {!loading && users.length > 0 ? (
        <div className="users-toolbar">
          <label className="users-search">
            <span className="sr-only">Buscar por nombre, DNI o correo</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, DNI o correo..."
              autoComplete="off"
            />
            {searchTerm ? (
              <button
                type="button"
                className="users-search__clear"
                onClick={() => setSearchTerm('')}
              >
                Limpiar
              </button>
            ) : null}
          </label>

          <div className="users-toolbar__filters">
            <label className="users-filter">
              <span>Estado</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as 'all' | 'active' | 'inactive',
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
            <label className="users-filter">
              <span>Rol</span>
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as 'all' | UserRole)
                }
              >
                <option value="all">Todos</option>
                {ALL_USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {userRoleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="users-toolbar__count">
            {filteredUsers.length} de {users.length} cuenta
            {users.length === 1 ? '' : 's'}
          </p>
        </div>
      ) : null}

      <div className="panel users-panel">{content}</div>

      <AppModal
        open={credentialsInfo !== null}
        title={credentialsInfo?.title ?? 'Clave temporal'}
        description="Guárdala ahora. No se volverá a mostrar."
        onClose={() => {
          setCredentialsInfo(null)
        }}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => {
                setCredentialsInfo(null)
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn--soft-primary"
              onClick={() => void copyTemporaryPassword()}
            >
              Copiar clave
            </button>
          </>
        }
      >
        {credentialsInfo ? (
          <div className="users-credentials">
            <p>
              <strong>{credentialsInfo.displayName}</strong>
            </p>
            {credentialsInfo.access ? (
              <p className="users-credentials__email">
                Acceso: {credentialsInfo.access}
              </p>
            ) : null}
            <label className="field">
              <span>Clave temporal</span>
              <input
                readOnly
                value={credentialsInfo.temporaryPassword}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          </div>
        ) : null}
      </AppModal>
    </section>
  )
}
