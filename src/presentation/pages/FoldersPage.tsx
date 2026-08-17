import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { Area } from '@/domain/entities/Area'
import type { User } from '@/domain/entities/User'
import { formatFolderAssignees } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { UserRole } from '@/domain/value-objects/UserRole'
import {
  folderMatchesSearch,
  sortFolders,
  type FolderSortOption,
} from '@/domain/services/FolderSearchService'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './FoldersPage.css'

function formatDateTime(date: Date): string {
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function wasFolderModified(folder: ImageFolder): boolean {
  return Math.abs(folder.updatedAt.getTime() - folder.createdAt.getTime()) > 60_000
}

type ModalMode = 'create' | 'edit' | null
type FolderViewMode = 'cards' | 'list'

const FOLDER_VIEW_STORAGE_KEY = 'consorcio-folder-view'

function readStoredViewMode(): FolderViewMode {
  const saved = localStorage.getItem(FOLDER_VIEW_STORAGE_KEY)
  return saved === 'list' ? 'list' : 'cards'
}

function IconFolderPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2m-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3z"
      />
    </svg>
  )
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-tile__glyph">
      <path
        fill="currentColor"
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-search__icon">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
      />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-tile__chevron">
      <path
        fill="currentColor"
        d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41.01"
      />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"
      />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"
      />
    </svg>
  )
}

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-meta__icon">
      <path
        fill="currentColor"
        d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z"
      />
    </svg>
  )
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-meta__icon">
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4"
      />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3m-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3m0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13m8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
      />
    </svg>
  )
}

function technicianInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function FolderAssigneePicker({
  assignToAllTechnicians,
  assignedTechnicianIds,
  technicians,
  currentUserId,
  onAssignAll,
  onAssignSpecific,
  onToggleTechnician,
}: {
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  technicians: User[]
  currentUserId?: string
  onAssignAll: () => void
  onAssignSpecific: () => void
  onToggleTechnician: (id: string) => void
}) {
  const [techSearch, setTechSearch] = useState('')
  const deferredTechSearch = useDeferredValue(techSearch)

  const filteredTechnicians = useMemo(() => {
    const term = deferredTechSearch.trim().toLowerCase()
    if (!term) return technicians
    return technicians.filter((tech) =>
      tech.displayName.toLowerCase().includes(term),
    )
  }, [technicians, deferredTechSearch])

  const selectedCount = assignToAllTechnicians
    ? technicians.length
    : assignedTechnicianIds.length

  return (
    <div className="folder-assignees">
      <div className="folder-assignees__head">
        <div>
          <p className="folder-assignees__label">Asignación</p>
          <p className="folder-assignees__hint">
            Quién podrá ver y trabajar esta carpeta
          </p>
        </div>
        <span className="folder-assignees__count">
          {assignToAllTechnicians
            ? 'Todos'
            : `${selectedCount} seleccionado${selectedCount === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="folder-assignees__modes" role="radiogroup" aria-label="Modo de asignación">
        <button
          type="button"
          className={`folder-assignees__mode ${assignToAllTechnicians ? 'is-active' : ''}`}
          aria-pressed={assignToAllTechnicians}
          onClick={onAssignAll}
        >
          <span className="folder-assignees__mode-icon" aria-hidden="true">
            <IconPeople />
          </span>
          <span className="folder-assignees__mode-copy">
            <strong>Todos los técnicos</strong>
            <small>Acceso general al equipo</small>
          </span>
          <span className="folder-assignees__mode-check" aria-hidden="true">
            <IconCheck />
          </span>
        </button>

        <button
          type="button"
          className={`folder-assignees__mode ${!assignToAllTechnicians ? 'is-active' : ''}`}
          aria-pressed={!assignToAllTechnicians}
          onClick={onAssignSpecific}
        >
          <span className="folder-assignees__mode-icon" aria-hidden="true">
            <IconPerson />
          </span>
          <span className="folder-assignees__mode-copy">
            <strong>Elegir técnicos</strong>
            <small>Uno o varios específicos</small>
          </span>
          <span className="folder-assignees__mode-check" aria-hidden="true">
            <IconCheck />
          </span>
        </button>
      </div>

      {!assignToAllTechnicians ? (
        <div className="folder-assignees__picker">
          {technicians.length > 4 ? (
            <label className="folder-assignees__search">
              <span className="sr-only">Buscar técnico</span>
              <IconSearch />
              <input
                type="search"
                value={techSearch}
                onChange={(event) => setTechSearch(event.target.value)}
                placeholder="Buscar técnico..."
                autoComplete="off"
              />
            </label>
          ) : null}

          {technicians.length === 0 ? (
            <p className="folder-assignees__empty">
              No hay técnicos activos para asignar.
            </p>
          ) : filteredTechnicians.length === 0 ? (
            <p className="folder-assignees__empty">
              Ningún técnico coincide con la búsqueda.
            </p>
          ) : (
            <div className="folder-assignees__grid" role="group" aria-label="Técnicos">
              {filteredTechnicians.map((tech) => {
                const selected = assignedTechnicianIds.includes(tech.id)
                const isYou = tech.id === currentUserId
                return (
                  <button
                    key={tech.id}
                    type="button"
                    className={`folder-assignees__tech ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => onToggleTechnician(tech.id)}
                  >
                    <span className="folder-assignees__avatar" aria-hidden="true">
                      {technicianInitials(tech.displayName)}
                    </span>
                    <span className="folder-assignees__tech-copy">
                      <strong>{tech.displayName}</strong>
                      {isYou ? <em>Tú</em> : <em>Técnico</em>}
                    </span>
                    <span className="folder-assignees__tech-check" aria-hidden="true">
                      <IconCheck />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="folder-assignees__all-note">
          Esta carpeta quedará visible para todos los técnicos activos.
        </p>
      )}
    </div>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-meta__icon">
      <path
        fill="currentColor"
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
      />
    </svg>
  )
}

function IconUpdated() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-meta__icon">
      <path
        fill="currentColor"
        d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6m6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26"
      />
    </svg>
  )
}

function FolderSchedule({ folder }: { folder: ImageFolder }) {
  const modified = wasFolderModified(folder)

  return (
    <div className="folder-tile__schedule">
      <span className="folder-meta-chip folder-meta-chip--time" title="Creada">
        <IconClock />
        <span>
          <em>Creada</em> {formatDateTime(folder.createdAt)}
        </span>
      </span>
      {modified ? (
        <span
          className="folder-meta-chip folder-meta-chip--updated"
          title="Última modificación"
        >
          <IconUpdated />
          <span>
            <em>Modificada</em> {formatDateTime(folder.updatedAt)}
          </span>
        </span>
      ) : null}
    </div>
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

function IconEmpty() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folders-empty__icon">
      <path
        fill="currentColor"
        d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2m0 12H4V8h16z"
      />
    </svg>
  )
}

function folderTone(name: string): string {
  const tones = ['blue', 'teal', 'green', 'cyan', 'slate']
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % tones.length
  }
  return tones[hash]
}

function FolderActions({
  folder,
  isAdmin,
  onEdit,
  onDelete,
}: {
  folder: ImageFolder
  isAdmin: boolean
  onEdit: (folder: ImageFolder) => void
  onDelete: (folder: ImageFolder) => void
}) {
  return (
    <div
      className="folder-tile__actions"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn--small btn--soft-teal"
        onClick={() => onEdit(folder)}
      >
        <IconEdit />
        Editar
      </button>
      {isAdmin ? (
        <button
          type="button"
          className="btn btn--small btn--soft-rose"
          onClick={() => onDelete(folder)}
        >
          <IconTrash />
          Eliminar
        </button>
      ) : null}
    </div>
  )
}

export function FoldersPage() {
  const { areaId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    listFoldersUseCase,
    createFolderUseCase,
    updateFolderUseCase,
    deleteFolderUseCase,
    getAreaUseCase,
    listTechniciansUseCase,
  } = useDependencies()

  const [area, setArea] = useState<Area | null>(null)
  const [folders, setFolders] = useState<ImageFolder[]>([])
  const [technicianOptions, setTechnicianOptions] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [activeFolder, setActiveFolder] = useState<ImageFolder | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    assignToAllTechnicians: false,
    assignedTechnicianIds: [] as string[],
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sortBy, setSortBy] = useState<FolderSortOption>('newest')
  const [viewMode, setViewMode] = useState<FolderViewMode>(readStoredViewMode)
  const deferredSearch = useDeferredValue(searchTerm)

  const isAdmin = user?.role === UserRole.Administrador

  useEffect(() => {
    localStorage.setItem(FOLDER_VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    if (!user) return
    void listTechniciansUseCase
      .execute(user)
      .then(setTechnicianOptions)
      .catch(() => setTechnicianOptions([]))
  }, [user, listTechniciansUseCase])

  const technicians = useMemo(() => {
    const names = new Set<string>()
    for (const folder of folders) {
      if (folder.assignToAllTechnicians) {
        names.add('Todos los técnicos')
        continue
      }
      for (const name of folder.assignedTechnicianNames ?? []) {
        if (name) names.add(name)
      }
      if ((folder.assignedTechnicianNames ?? []).length === 0 && folder.ownerName) {
        names.add(folder.ownerName)
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [folders])

  const filteredFolders = useMemo(() => {
    const matched = folders.filter((folder) => {
      const matchesSearch = folderMatchesSearch(folder, deferredSearch)
      const label = formatFolderAssignees(folder)
      const matchesOwner =
        ownerFilter === 'all' ||
        label === ownerFilter ||
        (folder.assignedTechnicianNames ?? []).includes(ownerFilter) ||
        folder.ownerName === ownerFilter
      return matchesSearch && matchesOwner
    })
    return sortFolders(matched, sortBy)
  }, [folders, deferredSearch, ownerFilter, sortBy])

  const totalImages = useMemo(
    () => folders.reduce((sum, folder) => sum + folder.imageCount, 0),
    [folders],
  )

  async function loadFolders() {
    if (!user || !areaId) return
    setLoading(true)
    setError(null)
    try {
      const [nextArea, result] = await Promise.all([
        getAreaUseCase.execute(user, areaId),
        listFoldersUseCase.execute(user, areaId),
      ])
      setArea(nextArea)
      setFolders(result)
    } catch (err) {
      setArea(null)
      swalError(
        err instanceof DomainError ? err.message : 'Error al cargar carpetas',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, areaId])

  function openCreateModal() {
    setActiveFolder(null)
    setForm({
      name: '',
      description: '',
      assignToAllTechnicians: false,
      assignedTechnicianIds: user?.role === UserRole.Tecnico && user.id ? [user.id] : [],
    })
    setStatusText('')
    setError(null)
    setModalMode('create')
  }

  function openEditModal(folder: ImageFolder) {
    setActiveFolder(folder)
    setForm({
      name: folder.name,
      description: folder.description,
      assignToAllTechnicians: folder.assignToAllTechnicians === true,
      assignedTechnicianIds:
        folder.assignToAllTechnicians
          ? []
          : folder.assignedTechnicianIds?.length
            ? [...folder.assignedTechnicianIds]
            : folder.ownerId
              ? [folder.ownerId]
              : [],
    })
    setStatusText('')
    setError(null)
    setModalMode('edit')
  }

  function toggleTechnician(technicianId: string) {
    setForm((prev) => {
      const selected = prev.assignedTechnicianIds.includes(technicianId)
        ? prev.assignedTechnicianIds.filter((id) => id !== technicianId)
        : [...prev.assignedTechnicianIds, technicianId]
      return { ...prev, assignedTechnicianIds: selected }
    })
  }

  function openDeleteModal(folder: ImageFolder) {
    void confirmDeleteFolder(folder)
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
    setActiveFolder(null)
    setStatusText('')
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !areaId) return
    setSubmitting(true)
    setError(null)
    setModalMode(null)
    swalSuccess('Carpeta creada')

    try {
      const folder = await createFolderUseCase.execute(user, {
        name: form.name,
        description: form.description,
        areaId,
        assignToAllTechnicians: form.assignToAllTechnicians,
        assignedTechnicianIds: form.assignedTechnicianIds,
      })

      await loadFolders()
      navigate(`/carpetas/${folder.id}`)
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo crear la carpeta',
      )
      setModalMode('create')
    } finally {
      setSubmitting(false)
      setStatusText('')
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !activeFolder) return
    setSubmitting(true)
    setError(null)

    const folderId = activeFolder.id
    const nextName = form.name
    const nextDescription = form.description
    const nextAssignAll = form.assignToAllTechnicians
    const nextAssignedIds = [...form.assignedTechnicianIds]

    setFolders((current) =>
      current.map((item) =>
        item.id === folderId
          ? {
              ...item,
              name: nextName.trim(),
              description: nextDescription.trim(),
              assignToAllTechnicians: nextAssignAll,
              assignedTechnicianIds: nextAssignAll ? [] : nextAssignedIds,
              updatedAt: new Date(),
            }
          : item,
      ),
    )
    setModalMode(null)
    setActiveFolder(null)
    swalSuccess('Carpeta actualizada')

    try {
      await updateFolderUseCase.execute(user, {
        folderId,
        name: nextName,
        description: nextDescription,
        assignToAllTechnicians: nextAssignAll,
        assignedTechnicianIds: nextAssignedIds,
      })

      await loadFolders()
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo editar la carpeta',
      )
      await loadFolders()
    } finally {
      setSubmitting(false)
      setStatusText('')
    }
  }

  async function confirmDeleteFolder(folder: ImageFolder) {
    if (!user || !isAdmin || submitting) return

    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar carpeta?',
      text: `"${folder.name}" se eliminará con todas sus fechas e imágenes. Esta acción no se puede deshacer.`,
    })
    if (!confirmed) return

    setSubmitting(true)
    setFolders((current) => current.filter((item) => item.id !== folder.id))
    swalSuccess('Carpeta eliminada')
    try {
      await deleteFolderUseCase.execute(user, folder.id)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo eliminar',
      )
      await loadFolders()
    } finally {
      setSubmitting(false)
    }
  }

  let content: ReactNode
  if (loading) {
    content = (
      <div className="folders-empty">
        <div className="folders-empty__spinner" />
        <p>Cargando carpetas...</p>
      </div>
    )
  } else if (folders.length === 0) {
    content = (
      <div className="folders-empty panel">
        <IconEmpty />
        <h3>Todavía no hay carpetas</h3>
        <p>Crea la primera para organizar las fotos de campo.</p>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={openCreateModal}
        >
          <IconFolderPlus />
          Nueva carpeta
        </button>
      </div>
    )
  } else if (filteredFolders.length === 0) {
    content = (
      <div className="folders-empty panel">
        <IconSearch />
        <h3>Sin resultados</h3>
        <p>Prueba otro término o limpia los filtros.</p>
        <button
          type="button"
          className="btn btn--soft-blue btn--small"
          onClick={() => {
            setSearchTerm('')
            setOwnerFilter('all')
          }}
        >
          Limpiar búsqueda
        </button>
      </div>
    )
  } else if (viewMode === 'cards') {
    content = (
      <div className="folders-grid">
        {filteredFolders.map((folder) => (
          <article
            key={folder.id}
            className={`folder-tile folder-tile--clickable folder-tile--${folderTone(folder.name)}`}
            role="link"
            tabIndex={0}
            aria-label={`Abrir carpeta ${folder.name}`}
            onClick={() => navigate(`/carpetas/${folder.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(`/carpetas/${folder.id}`)
              }
            }}
          >
            <div className="folder-tile__top">
              <div className="folder-tile__icon" aria-hidden="true">
                <IconFolder />
              </div>
              <div className="folder-tile__copy">
                <div className="folder-tile__title-row">
                  <h3>{folder.name}</h3>
                  <span className="folder-tile__open-hint">
                    Abrir
                    <IconChevron />
                  </span>
                </div>
                <p>{folder.description || 'Sin descripción'}</p>
              </div>
            </div>

            <div className="folder-tile__meta">
              <span className="folder-meta-chip">
                <IconPerson />
                {formatFolderAssignees(folder)}
              </span>
              <span className="folder-meta-chip">
                <IconImage />
                {folder.imageCount} imagen
                {folder.imageCount === 1 ? '' : 'es'}
              </span>
            </div>

            <FolderSchedule folder={folder} />

            <FolderActions
              folder={folder}
              isAdmin={isAdmin}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
            />
          </article>
        ))}
      </div>
    )
  } else {
    content = (
      <div className="folders-list-panel">
        <div className="table-wrap folders-list-desktop">
          <table className="data-table folders-list-table">
            <thead>
              <tr>
                <th>Carpeta</th>
                <th>Asignados</th>
                <th>Imágenes</th>
                <th>Creada</th>
                <th>Modificada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredFolders.map((folder) => (
                <tr
                  key={folder.id}
                  className="folders-list-row"
                  tabIndex={0}
                  aria-label={`Abrir carpeta ${folder.name}`}
                  onClick={() => navigate(`/carpetas/${folder.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/carpetas/${folder.id}`)
                    }
                  }}
                >
                  <td>
                    <div className="folders-list-name-cell">
                      <span
                        className={`folder-tile__icon folder-tile__icon--sm folder-tile--${folderTone(folder.name)}`}
                        aria-hidden="true"
                      >
                        <IconFolder />
                      </span>
                      <span>
                        <strong className="folder-list-name">{folder.name}</strong>
                        <span className="folder-list-desc">
                          {folder.description || 'Sin descripción'}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>{formatFolderAssignees(folder)}</td>
                  <td>{folder.imageCount}</td>
                  <td>
                    <span className="folders-list-datetime">
                      {formatDateTime(folder.createdAt)}
                    </span>
                  </td>
                  <td>
                    <span className="folders-list-datetime">
                      {wasFolderModified(folder)
                        ? formatDateTime(folder.updatedAt)
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <FolderActions
                      folder={folder}
                      isAdmin={isAdmin}
                      onEdit={openEditModal}
                      onDelete={openDeleteModal}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="folders-list-mobile">
          {filteredFolders.map((folder) => (
            <article
              key={folder.id}
              className={`folders-list-item folder-tile--${folderTone(folder.name)}`}
              role="link"
              tabIndex={0}
              aria-label={`Abrir carpeta ${folder.name}`}
              onClick={() => navigate(`/carpetas/${folder.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/carpetas/${folder.id}`)
                }
              }}
            >
              <div className="folders-list-item__main">
                <span
                  className={`folder-tile__icon folder-tile__icon--sm folder-tile--${folderTone(folder.name)}`}
                  aria-hidden="true"
                >
                  <IconFolder />
                </span>
                <div className="folders-list-item__copy">
                  <strong>{folder.name}</strong>
                  <p>{folder.description || 'Sin descripción'}</p>
                </div>
                <IconChevron />
              </div>

              <div className="folders-list-item__meta">
                <span>{formatFolderAssignees(folder)}</span>
                <span>
                  {folder.imageCount} foto
                  {folder.imageCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="folders-list-item__dates">
                <span>Creada {formatDateTime(folder.createdAt)}</span>
                {wasFolderModified(folder) ? (
                  <span>Modificada {formatDateTime(folder.updatedAt)}</span>
                ) : null}
              </div>

              <FolderActions
                folder={folder}
                isAdmin={isAdmin}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
              />
            </article>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="folders-page">
      <div className="page-header">
        <div>
          <p className="folders-page__eyebrow">
            <Link to="/areas" className="folders-page__back">
              ← Áreas
            </Link>
          </p>
          <h2>{area?.name || 'Carpetas'}</h2>
          <p>
            {area?.description?.trim()
              ? area.description
              : isAdmin
                ? 'Rutas/carpetas de esta área. Puedes asignar uno o más técnicos, o a todos.'
                : 'Organiza tus rutas de esta área y sube las fotos de campo.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={openCreateModal}
          disabled={!area}
        >
          <IconFolderPlus />
          Nueva carpeta
        </button>
      </div>

      {!loading && folders.length > 0 ? (
        <div className="folders-summary" aria-label="Resumen de carpetas">
          <div className="folders-summary__item">
            <strong>{folders.length}</strong>
            <span>carpetas</span>
          </div>
          <div className="folders-summary__item">
            <strong>{totalImages}</strong>
            <span>imágenes</span>
          </div>
          <div className="folders-summary__item">
            <strong>{filteredFolders.length}</strong>
            <span>visibles</span>
          </div>
        </div>
      ) : null}

      {error && !modalMode ? (
        <p className="form-alert form-alert--error">{error}</p>
      ) : null}

      {!loading && folders.length > 0 ? (
        <div className="folder-toolbar folders-toolbar">
          <label className="folder-search">
            <span className="sr-only">Buscar carpetas</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={
                isAdmin
                  ? 'Buscar por nombre, descripción o técnico...'
                  : 'Buscar carpeta...'
              }
              autoComplete="off"
            />
            {searchTerm ? (
              <button
                type="button"
                className="folder-search__clear"
                onClick={() => setSearchTerm('')}
              >
                Limpiar
              </button>
            ) : null}
          </label>

          <div className="folder-toolbar__filters">
            {isAdmin ? (
              <label className="folder-filter">
                <span>Asignado</span>
                <select
                  value={ownerFilter}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  {technicians.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="folder-filter">
              <span>Orden</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as FolderSortOption)
                }
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguas</option>
                <option value="name">Nombre A-Z</option>
                <option value="images">Más imágenes</option>
              </select>
            </label>

            <div
              className="folder-view-toggle"
              role="group"
              aria-label="Vista de carpetas"
            >
              <span>Vista</span>
              <div className="folder-view-toggle__buttons">
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
        </div>
      ) : null}

      {content}

      <AppModal
        open={modalMode === 'create'}
        title="Nueva carpeta"
        description="Define la carpeta. Las fotos se suben después, dentro de una fecha."
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
              form="folder-create-form"
              className="btn btn--soft-primary"
              disabled={submitting}
            >
              <IconFolderPlus />
              {submitting ? statusText || 'Guardando...' : 'Crear'}
            </button>
          </>
        }
      >
        <form
          id="folder-create-form"
          className="login-form"
          onSubmit={handleCreate}
        >
          <label className="field">
            <span>Nombre</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Ej. Inspección poste 14"
              required
            />
          </label>
          <label className="field">
            <span>Descripción</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Notas breves del trabajo en campo"
            />
          </label>
          <FolderAssigneePicker
            assignToAllTechnicians={form.assignToAllTechnicians}
            assignedTechnicianIds={form.assignedTechnicianIds}
            technicians={technicianOptions}
            currentUserId={user?.id}
            onAssignAll={() =>
              setForm((prev) => ({
                ...prev,
                assignToAllTechnicians: true,
                assignedTechnicianIds: [],
              }))
            }
            onAssignSpecific={() =>
              setForm((prev) => ({
                ...prev,
                assignToAllTechnicians: false,
                assignedTechnicianIds:
                  prev.assignedTechnicianIds.length > 0
                    ? prev.assignedTechnicianIds
                    : user?.role === UserRole.Tecnico && user.id
                      ? [user.id]
                      : [],
              }))
            }
            onToggleTechnician={toggleTechnician}
          />
          {error && modalMode === 'create' ? (
            <p className="form-alert form-alert--error">{error}</p>
          ) : null}
        </form>
      </AppModal>

      <AppModal
        open={modalMode === 'edit'}
        title="Editar carpeta"
        description="Actualiza el nombre, la descripción y la asignación."
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
              form="folder-edit-form"
              className="btn btn--soft-primary"
              disabled={submitting}
            >
              <IconEdit />
              {submitting ? statusText || 'Guardando...' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        <form
          id="folder-edit-form"
          className="login-form"
          onSubmit={handleEdit}
        >
          <label className="field">
            <span>Nombre</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </label>
          <label className="field">
            <span>Descripción</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <FolderAssigneePicker
            assignToAllTechnicians={form.assignToAllTechnicians}
            assignedTechnicianIds={form.assignedTechnicianIds}
            technicians={technicianOptions}
            currentUserId={user?.id}
            onAssignAll={() =>
              setForm((prev) => ({
                ...prev,
                assignToAllTechnicians: true,
                assignedTechnicianIds: [],
              }))
            }
            onAssignSpecific={() =>
              setForm((prev) => ({
                ...prev,
                assignToAllTechnicians: false,
                assignedTechnicianIds:
                  prev.assignedTechnicianIds.length > 0
                    ? prev.assignedTechnicianIds
                    : user?.role === UserRole.Tecnico && user.id
                      ? [user.id]
                      : [],
              }))
            }
            onToggleTechnician={toggleTechnician}
          />
          {error && modalMode === 'edit' ? (
            <p className="form-alert form-alert--error">{error}</p>
          ) : null}
        </form>
      </AppModal>
    </section>
  )
}
