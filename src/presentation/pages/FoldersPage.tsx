import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
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
import './FoldersPage.css'

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

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

type ModalMode = 'create' | 'edit' | 'delete' | null
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

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    listFoldersUseCase,
    createFolderUseCase,
    updateFolderUseCase,
    deleteFolderUseCase,
    uploadFolderImageUseCase,
  } = useDependencies()

  const [folders, setFolders] = useState<ImageFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [activeFolder, setActiveFolder] = useState<ImageFolder | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [form, setForm] = useState({ name: '', description: '' })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sortBy, setSortBy] = useState<FolderSortOption>('newest')
  const [viewMode, setViewMode] = useState<FolderViewMode>(readStoredViewMode)
  const deferredSearch = useDeferredValue(searchTerm)

  const isAdmin = user?.role === UserRole.Administrador

  useEffect(() => {
    localStorage.setItem(FOLDER_VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  const technicians = useMemo(() => {
    const names = new Set(
      folders.map((folder) => folder.ownerName).filter(Boolean),
    )
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [folders])

  const filteredFolders = useMemo(() => {
    const matched = folders.filter((folder) => {
      const matchesSearch = folderMatchesSearch(folder, deferredSearch)
      const matchesOwner =
        ownerFilter === 'all' || folder.ownerName === ownerFilter
      return matchesSearch && matchesOwner
    })
    return sortFolders(matched, sortBy)
  }, [folders, deferredSearch, ownerFilter, sortBy])

  const totalImages = useMemo(
    () => folders.reduce((sum, folder) => sum + folder.imageCount, 0),
    [folders],
  )

  async function loadFolders() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const result = await listFoldersUseCase.execute(user)
      setFolders(result)
    } catch (err) {
      setError(
        err instanceof DomainError ? err.message : 'Error al cargar carpetas',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFolders()
  }, [user])

  function openCreateModal() {
    setActiveFolder(null)
    setForm({ name: '', description: '' })
    setSelectedFiles([])
    setStatusText('')
    setError(null)
    setModalMode('create')
  }

  function openEditModal(folder: ImageFolder) {
    setActiveFolder(folder)
    setForm({ name: folder.name, description: folder.description })
    setSelectedFiles([])
    setStatusText('')
    setError(null)
    setModalMode('edit')
  }

  function openDeleteModal(folder: ImageFolder) {
    setActiveFolder(folder)
    setError(null)
    setModalMode('delete')
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
    setActiveFolder(null)
    setSelectedFiles([])
    setStatusText('')
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    setSelectedFiles(files ? Array.from(files) : [])
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)

    try {
      setStatusText('Creando carpeta...')
      const folder = await createFolderUseCase.execute(user, form)

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        setStatusText(`Subiendo ${index + 1} de ${selectedFiles.length}...`)
        await uploadFolderImageUseCase.execute(user, folder.id, {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          data: file,
        })
      }

      setModalMode(null)
      await loadFolders()
      navigate(`/carpetas/${folder.id}`)
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo crear la carpeta o subir las imágenes',
      )
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

    try {
      setStatusText('Guardando cambios...')
      await updateFolderUseCase.execute(user, {
        folderId: activeFolder.id,
        name: form.name,
        description: form.description,
      })

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        setStatusText(`Subiendo ${index + 1} de ${selectedFiles.length}...`)
        await uploadFolderImageUseCase.execute(user, activeFolder.id, {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          data: file,
        })
      }

      setModalMode(null)
      setActiveFolder(null)
      await loadFolders()
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo editar la carpeta',
      )
    } finally {
      setSubmitting(false)
      setStatusText('')
    }
  }

  async function handleDeleteConfirm() {
    if (!user || !activeFolder || !isAdmin) return
    setSubmitting(true)
    setError(null)

    try {
      await deleteFolderUseCase.execute(user, activeFolder.id)
      setModalMode(null)
      setActiveFolder(null)
      await loadFolders()
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'No se pudo eliminar')
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
                {folder.ownerName}
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
                <th>Técnico</th>
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
                  <td>{folder.ownerName}</td>
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
                <span>{folder.ownerName}</span>
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
          <p className="folders-page__eyebrow">Campo</p>
          <h2>Carpetas de imágenes</h2>
          <p>
            {isAdmin
              ? 'Revisa el trabajo de los técnicos con una vista clara y ordenada.'
              : 'Organiza tus fotos de campo, edita carpetas y sube varias imágenes a la vez.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={openCreateModal}
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
                <span>Técnico</span>
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
        description="Define la carpeta y, si quieres, sube imágenes al momento."
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
              {selectedFiles.length > 0 ? <IconUpload /> : <IconFolderPlus />}
              {submitting
                ? statusText || 'Guardando...'
                : selectedFiles.length > 0
                  ? 'Crear y subir'
                  : 'Crear'}
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
          <label className="field">
            <span>Imágenes (opcional, múltiples)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFilesChange}
              disabled={submitting}
            />
          </label>
          {selectedFiles.length > 0 ? (
            <div className="file-preview-list folders-file-preview">
              <p>{selectedFiles.length} imagen(es) lista(s) para subir</p>
              <ul>
                {selectedFiles.slice(0, 6).map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                    {file.name} · {formatBytes(file.size)}
                  </li>
                ))}
                {selectedFiles.length > 6 ? (
                  <li>... y {selectedFiles.length - 6} más</li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {error && modalMode === 'create' ? (
            <p className="form-alert form-alert--error">{error}</p>
          ) : null}
        </form>
      </AppModal>

      <AppModal
        open={modalMode === 'edit'}
        title="Editar carpeta"
        description="Actualiza los datos y agrega más imágenes si lo necesitas."
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
          <label className="field">
            <span>Agregar más imágenes (opcional)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFilesChange}
              disabled={submitting}
            />
          </label>
          {selectedFiles.length > 0 ? (
            <div className="file-preview-list folders-file-preview">
              <p>{selectedFiles.length} imagen(es) nuevas para subir</p>
              <ul>
                {selectedFiles.slice(0, 6).map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                    {file.name} · {formatBytes(file.size)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {error && modalMode === 'edit' ? (
            <p className="form-alert form-alert--error">{error}</p>
          ) : null}
        </form>
      </AppModal>

      <AppModal
        open={modalMode === 'delete'}
        title="Eliminar carpeta"
        description="Esta acción no se puede deshacer."
        onClose={closeModal}
        size="sm"
        danger
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
              type="button"
              className="btn btn--soft-rose"
              onClick={() => void handleDeleteConfirm()}
              disabled={submitting}
            >
              <IconTrash />
              {submitting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </>
        }
      >
        <p>
          ¿Eliminar la carpeta <strong>{activeFolder?.name}</strong> y todas sus
          imágenes?
        </p>
        {error && modalMode === 'delete' ? (
          <p className="form-alert form-alert--error">{error}</p>
        ) : null}
      </AppModal>
    </section>
  )
}
