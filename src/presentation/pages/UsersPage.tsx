import { useEffect, useMemo, useState } from 'react'
import type { User } from '@/domain/entities/User'
import { UserRole } from '@/domain/value-objects/UserRole'
import { isTechnicianSyntheticEmail } from '@/domain/value-objects/TechnicianLogin'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirm,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './UsersPage.css'

function userAccessLabel(item: User): string {
  if (item.dni) return item.dni
  if (isTechnicianSyntheticEmail(item.email) && item.dni) return item.dni
  return item.email
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
  const { listUsersUseCase, updateUserUseCase, resetUserPasswordUseCase } =
    useDependencies()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'all',
  )
  const [credentialsInfo, setCredentialsInfo] = useState<{
    title: string
    displayName: string
    dni?: string
    temporaryPassword: string
  } | null>(null)

  async function loadUsers() {
    if (!user) return
    setLoading(true)
    try {
      const result = await listUsersUseCase.execute(user)
      setUsers(
        result.filter(
          (item) =>
            item.role === UserRole.Tecnico && /^\d{8}$/.test(item.dni),
        ),
      )
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'Error al cargar las cuentas de la app',
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
        if (!query) return true
        return (
          item.displayName.toLowerCase().includes(query) ||
          item.dni.includes(query)
        )
      })
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, 'es'),
      )
  }, [users, searchTerm, statusFilter])

  const activeCount = users.filter((item) => item.active).length
  const busy = resettingUserId !== null

  async function handleToggleActive(target: User) {
    if (!user || busy) return
    const nextActive = !target.active
    const previous = target

    setUsers((current) =>
      current.map((item) =>
        item.id === target.id
          ? { ...item, active: nextActive, updatedAt: new Date() }
          : item,
      ),
    )
    swalSuccess(
      nextActive
        ? `${target.displayName} activado`
        : `${target.displayName} desactivado`,
    )

    try {
      const updated = await updateUserUseCase.execute(user, {
        userId: target.id,
        active: nextActive,
      })
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
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

  async function handleResetPassword(target: User) {
    if (!user || busy) return

    const confirmed = await swalConfirm({
      title: '¿Restablecer clave?',
      text: `Se asignará 87654321 a ${target.displayName}. Al ingresar a la app deberá cambiarla.`,
      confirmButtonText: 'Sí, restablecer',
      confirmButtonColor: '#f9a825',
    })
    if (!confirmed) return

    setResettingUserId(target.id)
    swalSuccess('Clave restablecida')

    try {
      const result = await resetUserPasswordUseCase.execute(user, target.id)
      setCredentialsInfo({
        title: 'Clave restablecida',
        displayName: target.displayName,
        dni: target.dni,
        temporaryPassword: result.temporaryPassword,
      })
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

  async function copyTemporaryPassword() {
    if (!credentialsInfo) return
    try {
      await navigator.clipboard.writeText(credentialsInfo.temporaryPassword)
      swalSuccess('Clave copiada')
    } catch {
      swalError('No se pudo copiar. Selecciónala manualmente.')
    }
  }

  function renderActions(item: User) {
    const toggleLabel = item.active ? 'Desactivar' : 'Activar'
    const resetLabel =
      resettingUserId === item.id ? 'Restableciendo...' : 'Restablecer clave'

    return (
      <div className="user-card__actions" role="group" aria-label="Acciones">
        <button
          type="button"
          className={`btn btn--icon-only ${
            item.active ? 'btn--soft-rose' : 'btn--soft-teal'
          }`}
          onClick={() => void handleToggleActive(item)}
          disabled={busy}
          title={toggleLabel}
          aria-label={toggleLabel}
        >
          {item.active ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          className="btn btn--icon-only btn--soft-amber"
          onClick={() => void handleResetPassword(item)}
          disabled={busy}
          title={resetLabel}
          aria-label={resetLabel}
        >
          <IconKey />
        </button>
      </div>
    )
  }

  let content
  if (loading) {
    content = (
      <div className="users-empty">
        <div className="users-empty__spinner" />
        <p>Cargando cuentas de la app...</p>
      </div>
    )
  } else if (users.length === 0) {
    content = (
      <div className="users-empty">
        <IconPeople />
        <h3>Sin cuentas de la app</h3>
        <p>
          Asigna el rol <strong>Técnico</strong> en Personal. La cuenta se crea
          sola y aparece aquí.
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
                <th>Código (DNI)</th>
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
                      <strong>{item.displayName}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="users-list-email">
                      {userAccessLabel(item)}
                    </span>
                  </td>
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
                  <p>Código: {userAccessLabel(item)}</p>
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
          <h2>Cuentas de la app</h2>
          <p>
            Solo control de acceso móvil: restablecer contraseña y desactivar.
            El alta, edición y rol se hacen en Personal.
          </p>
        </div>
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
      </div>

      {!loading && users.length > 0 ? (
        <div className="users-toolbar">
          <label className="users-search">
            <span className="sr-only">Buscar por nombre o DNI</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o DNI..."
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
            {credentialsInfo.dni ? (
              <p className="users-credentials__email">
                Código (DNI): {credentialsInfo.dni}
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
