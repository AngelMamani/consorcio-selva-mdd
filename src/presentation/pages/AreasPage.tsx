import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Area } from '@/domain/entities/Area'
import { DomainError } from '@/domain/errors/DomainError'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './AreasPage.css'

type AreasViewMode = 'cards' | 'list'

const AREAS_VIEW_STORAGE_KEY = 'consorcio-areas-view'

function readStoredViewMode(): AreasViewMode {
  const saved = localStorage.getItem(AREAS_VIEW_STORAGE_KEY)
  return saved === 'list' ? 'list' : 'cards'
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
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
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3.5-9h1v8h-1zm4 0h1v8h-1zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
      />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="areas-item__chevron">
      <path
        fill="currentColor"
        d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41.01"
      />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="areas-item__icon">
      <path
        fill="currentColor"
        d="M12 2 2 7l10 5 10-5zm0 9L2 6v2l10 5 10-5V6zm0 4L2 10v2l10 5 10-5v-2z"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="areas-search__icon">
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
      <path fill="currentColor" d="M3 5h8v6H3zm10 0h8v6h-8zM3 13h8v6H3zm10 0h8v6h-8z" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
    </svg>
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function AreasPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    listAreasUseCase,
    createAreaUseCase,
    updateAreaUseCase,
    deleteAreaUseCase,
    ensureDefaultNotificationsAreaUseCase,
  } = useDependencies()

  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<AreasViewMode>(readStoredViewMode)
  const deferredSearch = useDeferredValue(searchTerm)
  const ensureStartedRef = useRef(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Area | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cancelledTempIds = useRef(new Set<string>())
  const deletedIds = useRef(new Set<string>())

  const isAdmin = Boolean(user && canManageUsers(user.role))

  useEffect(() => {
    localStorage.setItem(AREAS_VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  const filteredAreas = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return areas
    return areas.filter((area) => {
      const haystack = `${area.name} ${area.description}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [areas, deferredSearch])

  async function loadAreasFast() {
    if (!user) return
    setLoading(true)
    try {
      const next = await listAreasUseCase.execute(user)
      setAreas(next.filter((item) => !deletedIds.current.has(item.id)))
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudieron cargar las actividades',
      )
    } finally {
      setLoading(false)
    }
  }

  async function ensureDefaultsInBackground() {
    if (!user || ensureStartedRef.current) return
    ensureStartedRef.current = true

    const alreadyReady = sessionStorage.getItem('consorcio-areas-ready') === '1'

    try {
      await ensureDefaultNotificationsAreaUseCase.execute(user, {
        migrateOrphans: !alreadyReady,
        createIfMissing: !alreadyReady,
      })
      sessionStorage.setItem('consorcio-areas-ready', '1')

      const next = await listAreasUseCase.execute(user)
      setAreas(next.filter((item) => !deletedIds.current.has(item.id)))
    } catch {
      // No bloquea la pantalla; el listado principal ya cargó.
      ensureStartedRef.current = false
    }
  }

  useEffect(() => {
    if (!user) return
    void (async () => {
      await loadAreasFast()
      void ensureDefaultsInBackground()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!modalOpen) return
    const id = window.setTimeout(() => nameInputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [modalOpen])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setModalOpen(true)
  }

  function openEdit(event: MouseEvent, area: Area) {
    event.preventDefault()
    event.stopPropagation()
    setEditing(area)
    setName(area.name)
    setDescription(area.description)
    setModalOpen(true)
  }

  async function confirmDelete(event: MouseEvent, area: Area) {
    event.preventDefault()
    event.stopPropagation()
    if (!user) return

    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar actividad?',
      text: `"${area.name}" se eliminará junto con sus carpetas, fechas y fotos.`,
    })
    if (!confirmed) return

    deletedIds.current.add(area.id)
    setAreas((current) => current.filter((item) => item.id !== area.id))
    swalSuccess('Actividad eliminada')

    if (area.id.startsWith('temp:')) {
      cancelledTempIds.current.add(area.id)
      return
    }

    try {
      await deleteAreaUseCase.execute(user, area.id)
    } catch (err) {
      deletedIds.current.delete(area.id)
      setAreas((current) =>
        [...current, area].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      )
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo eliminar la actividad',
      )
    }
  }

  function openArea(areaId: string) {
    navigate(`/areas/${areaId}/tecnicos`)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || busy) return
    setBusy(true)
    try {
      if (editing) {
        const previous = editing
        const optimistic: Area = {
          ...previous,
          name: name.trim(),
          description: description.trim(),
          updatedAt: new Date(),
        }
        setAreas((current) =>
          current
            .map((item) => (item.id === previous.id ? optimistic : item))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
        setModalOpen(false)
        swalSuccess('Actividad actualizada')
        const updated = await updateAreaUseCase.execute(user, previous.id, {
          name,
          description,
        })
        setAreas((current) =>
          current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
      } else {
        const optimistic: Area = {
          id: `temp:${crypto.randomUUID()}`,
          name: name.trim(),
          description: description.trim(),
          createdById: user.id,
          createdByName: user.displayName,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        setAreas((current) =>
          [...current, optimistic].sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
          ),
        )
        setModalOpen(false)
        swalSuccess('Actividad creada')
        const created = await createAreaUseCase.execute(user, {
          name,
          description,
        })
        if (cancelledTempIds.current.has(optimistic.id)) {
          cancelledTempIds.current.delete(optimistic.id)
          await deleteAreaUseCase.execute(user, created.id)
          return
        }
        setAreas((current) =>
          current
            .map((item) => (item.id === optimistic.id ? created : item))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
      }
    } catch (err) {
      setModalOpen(true)
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo guardar la actividad',
      )
      await loadAreasFast()
    } finally {
      setBusy(false)
    }
  }

  function renderActions(area: Area) {
    if (!isAdmin) return null
    return (
      <div
        className="areas-item__actions"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="btn btn--icon-only btn--soft-blue"
          title="Editar"
          aria-label={`Editar ${area.name}`}
          onClick={(event) => openEdit(event, area)}
        >
          <IconEdit />
        </button>
        <button
          type="button"
          className="btn btn--icon-only btn--soft-rose"
          title="Eliminar"
          aria-label={`Eliminar ${area.name}`}
          onClick={(event) => void confirmDelete(event, area)}
        >
          <IconTrash />
        </button>
      </div>
    )
  }

  if (!user) return null

  return (
    <section className="areas-page">
      <div className="page-header">
        <div>
          <p className="areas-page__eyebrow">Campo</p>
          <h1>Actividades</h1>
          <p>
            Cada actividad agrupa el trabajo de campo: carpeta del técnico,
            luego la carpeta de la ruta con la fecha publicada, y dentro las
            fotos para exportar a PDF.
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={openCreate}
            disabled={busy}
          >
            <IconPlus />
            Nueva actividad
          </button>
        ) : null}
      </div>

      {!loading && areas.length > 0 ? (
        <div className="areas-summary" aria-label="Resumen de actividades">
          <div className="areas-summary__item">
            <strong>{areas.length}</strong>
            <span>actividades</span>
          </div>
          <div className="areas-summary__item">
            <strong>{filteredAreas.length}</strong>
            <span>visibles</span>
          </div>
        </div>
      ) : null}

      {!loading && areas.length > 0 ? (
        <div className="areas-toolbar">
          <label className="areas-search">
            <span className="sr-only">Buscar actividades</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o descripción…"
              autoComplete="off"
            />
            {searchTerm ? (
              <button
                type="button"
                className="areas-search__clear"
                onClick={() => setSearchTerm('')}
              >
                Limpiar
              </button>
            ) : null}
          </label>

          <div
            className="areas-view-toggle"
            role="group"
            aria-label="Vista de actividades"
          >
            <span>Vista</span>
            <div className="areas-view-toggle__buttons">
              <button
                type="button"
                className={viewMode === 'cards' ? 'is-active' : ''}
                onClick={() => setViewMode('cards')}
              >
                <IconCards />
                Tarjetas
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
      ) : null}

      {loading ? (
        <div className="areas-skeleton" aria-busy="true" aria-label="Cargando">
          <div className="areas-skeleton__bar" />
          <div className="areas-skeleton__grid">
            <div className="areas-skeleton__card" />
            <div className="areas-skeleton__card" />
            <div className="areas-skeleton__card" />
          </div>
        </div>
      ) : areas.length === 0 ? (
        <div className="areas-empty">
          <h2>Sin actividades</h2>
          <p>
            Un administrador debe crear al menos una actividad. Todas usan el
            mismo catálogo de suministros.
          </p>
          {isAdmin ? (
            <button
              type="button"
              className="btn btn--soft-primary"
              onClick={openCreate}
            >
              <IconPlus />
              Crear actividad
            </button>
          ) : null}
        </div>
      ) : filteredAreas.length === 0 ? (
        <div className="areas-empty">
          <h2>Sin resultados</h2>
          <p>No hay actividades que coincidan con “{searchTerm.trim()}”.</p>
          <button
            type="button"
            className="btn btn--soft-muted btn--small"
            onClick={() => setSearchTerm('')}
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="areas-grid" role="list">
          {filteredAreas.map((area) => (
            <article
              key={area.id}
              role="listitem"
              className="areas-tile"
              tabIndex={0}
              onClick={() => openArea(area.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openArea(area.id)
                }
              }}
            >
              <div className="areas-tile__top">
                <span className="areas-tile__glyph" aria-hidden="true">
                  <IconLayers />
                </span>
                {renderActions(area)}
              </div>
              <div className="areas-tile__body">
                <h2>{area.name}</h2>
                <p>
                  {area.description.trim()
                    ? area.description
                    : 'Sin descripción'}
                </p>
              </div>
              <div className="areas-tile__footer">
                <span>Actualizada {formatDate(area.updatedAt)}</span>
                <span className="areas-tile__enter">
                  Abrir
                  <IconChevron />
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="areas-table-wrap">
          <table className="areas-table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Descripción</th>
                <th>Actualizada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAreas.map((area) => (
                <tr
                  key={area.id}
                  tabIndex={0}
                  onClick={() => openArea(area.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openArea(area.id)
                    }
                  }}
                >
                  <td>
                    <div className="areas-table__name">
                      <span className="areas-table__glyph" aria-hidden="true">
                        <IconLayers />
                      </span>
                      <strong>{area.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="areas-table__desc">
                      {area.description.trim()
                        ? area.description
                        : 'Sin descripción'}
                    </span>
                  </td>
                  <td>{formatDate(area.updatedAt)}</td>
                  <td>
                    <div className="areas-table__actions">
                      {renderActions(area)}
                      <IconChevron />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? 'Editar actividad' : 'Nueva actividad'}
        description="Nombre de la actividad. Ej. Notificaciones, Cortes, Reclamos."
        size="sm"
        onClose={() => !busy && setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="area-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="area-form" onSubmit={(e) => void handleSave(e)}>
          <div className="areas-form">
            <label className="field">
              <span>Nombre</span>
              <input
                ref={nameInputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Notificaciones"
                required
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Descripción (opcional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                maxLength={500}
              />
            </label>
          </div>
        </form>
      </AppModal>
    </section>
  )
}
