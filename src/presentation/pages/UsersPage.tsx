import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { User } from '@/domain/entities/User'
import { UserRole, userRoleLabel } from '@/domain/value-objects/UserRole'
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

type UsersViewMode = 'cards' | 'list'

const USERS_VIEW_STORAGE_KEY = 'consorcio-users-view'

function readStoredViewMode(): UsersViewMode {
  const saved = localStorage.getItem(USERS_VIEW_STORAGE_KEY)
  return saved === 'list' ? 'list' : 'cards'
}

function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m-9-2V8H4v2H2v2h2v2h2v-2h2v-2zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4"
      />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="user-chip__icon">
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5zm0 10.99h6c-.53 4.12-3.28 7.79-6 8.94V13H6V6.3l6-2.25z"
      />
    </svg>
  )
}

function IconWrench() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="user-chip__icon">
      <path
        fill="currentColor"
        d="M22.7 19.4 13.6 10.3a6 6 0 0 0-7.1-7.1L9.9 6.6 6.6 9.9 3.2 6.5a6 6 0 0 0 7.1 7.1l9.1 9.1c.4.4 1 .4 1.4 0l1.9-1.9c.4-.4.4-1 0-1.4"
      />
    </svg>
  )
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

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="user-card__meta-icon">
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 4-8 5-8-5V6l8 5 8-5z"
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

function IconCards() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M3 5h8v6H3zm10 0h8v6h-8zM3 13h8v6H3zm10 0h8v6h-8z"
      />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"
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

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
      />
    </svg>
  )
}

function UserActions({
  item,
  isSelf,
  busy,
  resetting,
  onEdit,
  onToggleActive,
  onResetPassword,
}: {
  item: User
  isSelf: boolean
  busy: boolean
  resetting: boolean
  onEdit: (user: User) => void
  onToggleActive: (user: User) => void
  onResetPassword: (user: User) => void
}) {
  const toggleLabel = item.active ? 'Desactivar' : 'Activar'
  const resetLabel = resetting ? 'Restableciendo...' : 'Restablecer clave'

  return (
    <div className="user-card__actions" role="group" aria-label="Acciones">
      <button
        type="button"
        className="btn btn--icon-only btn--soft-blue"
        onClick={() => onEdit(item)}
        disabled={busy}
        title="Editar usuario"
        aria-label="Editar usuario"
      >
        <IconEdit />
      </button>
      <button
        type="button"
        className={`btn btn--icon-only ${
          item.active ? 'btn--soft-rose' : 'btn--soft-teal'
        }`}
        onClick={() => onToggleActive(item)}
        disabled={isSelf || busy}
        title={
          isSelf ? 'No puedes desactivar tu propia cuenta' : toggleLabel
        }
        aria-label={
          isSelf ? 'No puedes desactivar tu propia cuenta' : toggleLabel
        }
      >
        {item.active ? <IconPause /> : <IconPlay />}
      </button>
      <button
        type="button"
        className="btn btn--icon-only btn--soft-amber"
        onClick={() => onResetPassword(item)}
        disabled={isSelf || busy}
        title={
          isSelf ? 'No puedes restablecer tu propia clave aquí' : resetLabel
        }
        aria-label={
          isSelf ? 'No puedes restablecer tu propia clave aquí' : resetLabel
        }
      >
        <IconKey />
      </button>
    </div>
  )
}

export function UsersPage() {
  const { user, setUser } = useAuth()
  const {
    listUsersUseCase,
    createUserUseCase,
    updateUserUseCase,
    resetUserPasswordUseCase,
  } = useDependencies()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>(UserRole.Tecnico)
  const [credentialsInfo, setCredentialsInfo] = useState<{
    title: string
    displayName: string
    email?: string
    temporaryPassword: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [viewMode, setViewMode] = useState<UsersViewMode>(readStoredViewMode)
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    role: UserRole.Tecnico as
      | typeof UserRole.Tecnico
      | typeof UserRole.Administrador,
  })

  useEffect(() => {
    localStorage.setItem(USERS_VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  async function loadUsers() {
    if (!user) return
    setLoading(true)
    try {
      const result = await listUsersUseCase.execute(user)
      setUsers(result)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'Error al cargar usuarios',
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
    return users.filter((item) => {
      const matchesRole = roleFilter === 'all' || item.role === roleFilter
      if (!matchesRole) return false
      if (!query) return true
      return (
        item.displayName.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query)
      )
    })
  }, [users, searchTerm, roleFilter])

  function closeModal() {
    if (submitting) return
    setShowModal(false)
  }

  function openEditModal(target: User) {
    setEditingUser(target)
    setEditName(target.displayName)
    setEditRole(target.role)
  }

  function closeEditModal() {
    if (submitting) return
    setEditingUser(null)
    setEditName('')
    setEditRole(UserRole.Tecnico)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || submitting) return

    const payload = { ...form }
    setSubmitting(true)
    setShowModal(false)
    swalSuccess('Usuario creado')

    try {
      const created = await createUserUseCase.execute(user, payload)
      setForm({
        displayName: '',
        email: '',
        role: UserRole.Tecnico,
      })
      setCredentialsInfo({
        title: 'Usuario creado',
        displayName: created.user.displayName,
        email: created.user.email,
        temporaryPassword: created.temporaryPassword,
      })
      setUsers((current) => [created.user, ...current])
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo crear el usuario',
      )
      setForm(payload)
      setShowModal(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !editingUser || submitting) return

    const nextName = editName.trim()
    if (!nextName) {
      swalError('El nombre no puede estar vacío')
      return
    }
    if (nextName.length > 120) {
      swalError('El nombre es demasiado largo')
      return
    }

    const nameChanged = nextName !== editingUser.displayName
    const roleChanged = editRole !== editingUser.role
    if (!nameChanged && !roleChanged) {
      closeEditModal()
      return
    }

    if (roleChanged && user.id === editingUser.id) {
      swalError('No puedes cambiar tu propio rol')
      return
    }

    if (roleChanged) {
      const confirmed = await swalConfirm({
        title: '¿Cambiar rol?',
        text: `${editingUser.displayName} pasará a ser ${userRoleLabel(editRole)}.`,
        confirmButtonText: 'Sí, cambiar',
      })
      if (!confirmed) return
    }

    const previous = editingUser
    const userId = editingUser.id
    const nextRole = editRole

    setUsers((current) =>
      current.map((item) =>
        item.id === userId
          ? {
              ...item,
              displayName: nextName,
              role: nextRole,
              updatedAt: new Date(),
            }
          : item,
      ),
    )
    if (user.id === userId) {
      setUser({
        ...user,
        displayName: nextName,
        role: nextRole,
        updatedAt: new Date(),
      })
    }
    setEditingUser(null)
    setEditName('')
    setEditRole(UserRole.Tecnico)
    swalSuccess(roleChanged ? 'Usuario actualizado' : 'Nombre actualizado')

    setSubmitting(true)
    try {
      const updated = await updateUserUseCase.execute(user, {
        userId,
        displayName: nextName,
        role: nextRole,
      })
      if (user.id === updated.id) {
        setUser(updated)
      }
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (err) {
      setUsers((current) =>
        current.map((item) => (item.id === previous.id ? previous : item)),
      )
      if (user.id === previous.id) {
        setUser(previous)
      }
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo actualizar el usuario',
      )
      setEditingUser(previous)
      setEditName(previous.displayName)
      setEditRole(previous.role)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(target: User) {
    if (!user || submitting || resettingUserId) return

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
    if (!user || submitting || resettingUserId) return

    const confirmed = await swalConfirm({
      title: '¿Restablecer clave?',
      text: `Se asignará 87654321 a ${target.displayName}. Al ingresar deberá elegir una más segura.`,
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
        email: target.email,
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

  const activeCount = users.filter((item) => item.active).length
  const techCount = users.filter((item) => item.role === UserRole.Tecnico).length
  const busy = resettingUserId !== null
  const editingSelf = Boolean(user && editingUser && user.id === editingUser.id)
  const editingLastAdmin = Boolean(
    editingUser &&
      editingUser.role === UserRole.Administrador &&
      users.filter(
        (item) =>
          item.id !== editingUser.id &&
          item.role === UserRole.Administrador &&
          item.active,
      ).length === 0,
  )
  const canChangeEditRole = !editingSelf && !editingLastAdmin

  let content: ReactNode
  if (loading) {
    content = (
      <div className="users-empty">
        <div className="users-empty__spinner" />
        <p>Cargando el equipo...</p>
      </div>
    )
  } else if (users.length === 0) {
    content = (
      <div className="users-empty">
        <IconPeople />
        <h3>Aún no hay gente registrada</h3>
        <p>Crea el primer administrador o técnico para empezar.</p>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={() => {
            setShowModal(true)
          }}
        >
          <IconUserPlus />
          Nuevo usuario
        </button>
      </div>
    )
  } else if (filteredUsers.length === 0) {
    content = (
      <div className="users-empty">
        <IconSearch />
        <h3>Sin resultados</h3>
        <p>Prueba otro nombre, correo o filtro de rol.</p>
        <button
          type="button"
          className="btn btn--soft-blue btn--small"
          onClick={() => {
            setSearchTerm('')
            setRoleFilter('all')
          }}
        >
          Limpiar filtros
        </button>
      </div>
    )
  } else if (viewMode === 'cards') {
    content = (
      <div className="users-grid">
        {filteredUsers.map((item) => {
          const isAdminRole = item.role === UserRole.Administrador
          const isSelf = item.id === user?.id

          return (
            <article
              key={item.id}
              className={[
                'user-card',
                isAdminRole ? 'user-card--admin' : 'user-card--tech',
                item.active ? '' : 'user-card--inactive',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="user-card__main">
                <div
                  className={`user-avatar user-avatar--${avatarTone(item.displayName)}`}
                  aria-hidden="true"
                >
                  {getInitials(item.displayName)}
                </div>
                <div className="user-card__identity">
                  <div className="user-card__name-row">
                    <h3>{item.displayName}</h3>
                    {isSelf ? (
                      <span className="user-chip user-chip--you">Tú</span>
                    ) : null}
                  </div>
                  <p className="user-card__email">
                    <IconMail />
                    <span>{item.email}</span>
                  </p>
                </div>
                <span
                  className={`user-card__status-dot ${
                    item.active
                      ? 'user-card__status-dot--on'
                      : 'user-card__status-dot--off'
                  }`}
                  title={item.active ? 'Activo' : 'Inactivo'}
                  aria-hidden="true"
                />
              </div>

              <div className="user-card__tags">
                <span
                  className={`user-chip ${
                    isAdminRole ? 'user-chip--admin' : 'user-chip--tech'
                  }`}
                >
                  {isAdminRole ? <IconShield /> : <IconWrench />}
                  {userRoleLabel(item.role)}
                </span>
                <span
                  className={`status-pill ${
                    item.active
                      ? 'status-pill--active'
                      : 'status-pill--inactive'
                  }`}
                >
                  {item.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="user-card__footer">
                <UserActions
                  item={item}
                  isSelf={isSelf}
                  busy={busy || submitting}
                  resetting={resettingUserId === item.id}
                  onEdit={openEditModal}
                  onToggleActive={(target) => void handleToggleActive(target)}
                  onResetPassword={(target) => void handleResetPassword(target)}
                />
              </div>
            </article>
          )
        })}
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
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((item) => {
                const isAdminRole = item.role === UserRole.Administrador
                const isSelf = item.id === user?.id

                return (
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
                        <div>
                          <strong>{item.displayName}</strong>
                          {isSelf ? (
                            <span className="user-chip user-chip--you">Tú</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="users-list-email">{item.email}</span>
                    </td>
                    <td>
                      <span
                        className={`user-chip ${
                          isAdminRole ? 'user-chip--admin' : 'user-chip--tech'
                        }`}
                      >
                        {isAdminRole ? <IconShield /> : <IconWrench />}
                        {userRoleLabel(item.role)}
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
                    <td>
                      <UserActions
                        item={item}
                        isSelf={isSelf}
                        busy={busy || submitting}
                        resetting={resettingUserId === item.id}
                        onEdit={openEditModal}
                        onToggleActive={(target) =>
                          void handleToggleActive(target)
                        }
                        onResetPassword={(target) =>
                          void handleResetPassword(target)
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="users-list-mobile">
          {filteredUsers.map((item) => {
            const isAdminRole = item.role === UserRole.Administrador
            const isSelf = item.id === user?.id

            return (
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
                    <strong>
                      {item.displayName}
                      {isSelf ? (
                        <span className="user-chip user-chip--you">Tú</span>
                      ) : null}
                    </strong>
                    <p>{item.email}</p>
                  </div>
                  <UserActions
                    item={item}
                    isSelf={isSelf}
                    busy={busy || submitting}
                    resetting={resettingUserId === item.id}
                    onEdit={openEditModal}
                    onToggleActive={(target) => void handleToggleActive(target)}
                    onResetPassword={(target) => void handleResetPassword(target)}
                  />
                </div>

                <div className="users-list-item__tags">
                  <span
                    className={`user-chip ${
                      isAdminRole ? 'user-chip--admin' : 'user-chip--tech'
                    }`}
                  >
                    {isAdminRole ? <IconShield /> : <IconWrench />}
                    {userRoleLabel(item.role)}
                  </span>
                  <span
                    className={`status-pill ${
                      item.active
                        ? 'status-pill--active'
                        : 'status-pill--inactive'
                    }`}
                  >
                    {item.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="users-page">
      <div className="page-header">
        <div>
          <p className="users-page__eyebrow">Administración</p>
          <h2>Usuarios</h2>
          <p>
            Gestiona cuentas del equipo: alta, roles, estado de acceso y claves
            temporales.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={() => {
            setShowModal(true)
          }}
        >
          <IconUserPlus />
          Nuevo usuario
        </button>
      </div>

      <div className="users-summary" aria-label="Resumen del equipo">
        <div className="users-summary__item users-summary__item--total">
          <span className="users-summary__icon" aria-hidden="true">
            <IconPeople />
          </span>
          <div>
            <strong>{users.length}</strong>
            <span>usuarios</span>
          </div>
        </div>
        <div className="users-summary__item users-summary__item--active">
          <span className="users-summary__icon" aria-hidden="true">
            <IconPlay />
          </span>
          <div>
            <strong>{activeCount}</strong>
            <span>activos</span>
          </div>
        </div>
        <div className="users-summary__item users-summary__item--tech">
          <span className="users-summary__icon" aria-hidden="true">
            <IconWrench />
          </span>
          <div>
            <strong>{techCount}</strong>
            <span>técnicos</span>
          </div>
        </div>
      </div>

      {!loading && users.length > 0 ? (
        <div className="users-toolbar">
          <label className="users-search">
            <span className="sr-only">Buscar personas</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o correo..."
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
              <span>Rol</span>
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as 'all' | UserRole)
                }
              >
                <option value="all">Todos</option>
                <option value={UserRole.Tecnico}>Técnicos</option>
                <option value={UserRole.Administrador}>Administradores</option>
              </select>
            </label>

            <div
              className="users-view-toggle"
              role="group"
              aria-label="Vista de usuarios"
            >
              <span>Vista</span>
              <div className="users-view-toggle__buttons">
                <button
                  type="button"
                  className={viewMode === 'cards' ? 'is-active' : ''}
                  onClick={() => setViewMode('cards')}
                >
                  <IconCards />
                  Cartas
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? 'is-active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  <IconList />
                  Lista
                </button>
              </div>
            </div>
          </div>

          <p className="users-toolbar__count">
            {filteredUsers.length} de {users.length} persona
            {users.length === 1 ? '' : 's'}
          </p>
        </div>
      ) : null}

      <div className="panel users-panel">{content}</div>

      <AppModal
        open={showModal}
        title="Nuevo usuario"
        description="Se crea con la clave temporal 87654321. En el primer ingreso deberá cambiarla."
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={closeModal}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="user-create-form"
              className="btn btn--soft-primary"
              disabled={submitting}
            >
              <IconUserPlus />
              Crear usuario
            </button>
          </>
        }
      >
        <form
          id="user-create-form"
          className="login-form"
          onSubmit={handleCreate}
        >
          <label className="field">
            <span>Nombre completo</span>
            <input
              value={form.displayName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  displayName: event.target.value,
                }))
              }
              placeholder="Ej. María Quispe"
              required
            />
          </label>
          <label className="field">
            <span>Correo</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="correo@empresa.com"
              required
            />
          </label>
          <div className="users-temp-hint">
            <IconKey />
            <p>
              Clave temporal:{' '}
              <strong>87654321</strong>. Debe cambiarla al primer ingreso.
            </p>
          </div>
          <label className="field">
            <span>Rol</span>
            <select
              value={form.role}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  role: event.target.value as typeof form.role,
                }))
              }
            >
              <option value={UserRole.Tecnico}>Técnico de campo</option>
              <option value={UserRole.Administrador}>Administrador</option>
            </select>
          </label>
        </form>
      </AppModal>

      <AppModal
        open={editingUser !== null}
        title="Editar usuario"
        description={
          editingUser
            ? `Actualiza el nombre o el rol de ${editingUser.email}.`
            : undefined
        }
        onClose={closeEditModal}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={closeEditModal}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="user-edit-form"
              className="btn btn--soft-primary"
              disabled={submitting}
            >
              <IconEdit />
              Guardar cambios
            </button>
          </>
        }
      >
        <form
          id="user-edit-form"
          className="login-form"
          onSubmit={(event) => void handleUpdateUser(event)}
        >
          <label className="field">
            <span>Nombre completo</span>
            <input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder="Ej. María Quispe"
              maxLength={120}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Rol</span>
            <select
              value={editRole}
              onChange={(event) =>
                setEditRole(event.target.value as UserRole)
              }
              disabled={submitting || !canChangeEditRole}
            >
              <option value={UserRole.Tecnico}>Técnico de campo</option>
              <option value={UserRole.Administrador}>Administrador</option>
            </select>
            <p className="users-edit-hint">
              {editingSelf
                ? 'No puedes cambiar tu propio rol.'
                : editingLastAdmin
                  ? 'Debe quedar al menos un administrador activo.'
                  : 'El técnico usa la app móvil. El administrador entra al panel web.'}
            </p>
          </label>
        </form>
      </AppModal>

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
            {credentialsInfo.email ? (
              <p className="users-credentials__email">{credentialsInfo.email}</p>
            ) : null}
            <label className="field">
              <span>Clave temporal</span>
              <input
                readOnly
                value={credentialsInfo.temporaryPassword}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <div className="users-temp-hint">
              <IconKey />
              <p>
                Al ingresar (web o app móvil) deberá cambiarla por una más
                segura antes de continuar.
              </p>
            </div>
          </div>
        ) : null}
      </AppModal>
    </section>
  )
}
