import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDateKey } from '@/domain/entities/FolderDate'
import type {
  ActivityTechnicianFolder,
  PublishedTechnicianWork,
} from '@/domain/entities/TechnicianActivityWork'
import { workFolderTitle } from '@/domain/entities/TechnicianActivityWork'
import { DomainError } from '@/domain/errors/DomainError'
import { formatRouteCode } from '@/domain/services/SupplySearchService'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError } from '@/presentation/utils/appSwal'
import './FoldersPage.css'
import './ActivityWorkPages.css'

function folderTone(name: string): string {
  const tones = ['blue', 'teal', 'green', 'cyan', 'slate']
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index) * (index + 1)) % tones.length
  }
  return tones[hash]
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"
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

function workLabel(work: PublishedTechnicianWork): string {
  const route = work.routeCode
    ? formatRouteCode(work.routeCode)
    : work.folderName
  return `${route} · ${formatDateKey(work.dateKey)}`
}

export function TechnicianWorkPage() {
  const { areaId = '', technicianId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { listActivityPublishedWorkUseCase } = useDependencies()

  const [areaName, setAreaName] = useState('')
  const [technician, setTechnician] = useState<ActivityTechnicianFolder | null>(
    null,
  )
  const [works, setWorks] = useState<PublishedTechnicianWork[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return works
    return works.filter((work) =>
      workLabel(work).toLowerCase().includes(query),
    )
  }, [works, deferredSearch])

  useEffect(() => {
    if (!user || !areaId || !technicianId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const result = await listActivityPublishedWorkUseCase.execute(
          user,
          areaId,
        )
        if (cancelled) return
        setAreaName(result.areaName)
        const nextTechnician =
          result.technicians.find(
            (item) => item.technicianId === technicianId,
          ) ?? null
        setTechnician(nextTechnician)
        setWorks(
          result.works.filter((work) => work.technicianId === technicianId),
        )
      } catch (error) {
        if (!cancelled) {
          swalError(
            error instanceof DomainError
              ? error.message
              : 'No se pudieron cargar los trabajos publicados',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, areaId, technicianId, listActivityPublishedWorkUseCase])

  if (!user) return null

  const name = technician?.technicianName || 'Técnico'

  return (
    <section className="folders-page activity-work-page">
      <div className="page-header">
        <div>
          <Link
            to={`/areas/${areaId}/tecnicos`}
            className="folders-page__back"
          >
            <IconBack />
            {areaName || 'Técnicos'}
          </Link>
          <p className="folders-page__eyebrow">Carpeta del técnico</p>
          <h1>{name}</h1>
          <p>
            Trabajos publicados: carpeta de la ruta más la fecha. Entra para
            ver las fotos y exportarlas a PDF.
          </p>
        </div>
      </div>

      {!loading && works.length > 0 ? (
        <div className="folders-summary" aria-label="Resumen de trabajos">
          <div className="folders-summary__item">
            <strong>{works.length}</strong>
            <span>trabajos publicados</span>
          </div>
          <div className="folders-summary__item">
            <strong>{technician?.imageCount ?? 0}</strong>
            <span>fotos</span>
          </div>
          <div className="folders-summary__item">
            <strong>{filtered.length}</strong>
            <span>visibles</span>
          </div>
        </div>
      ) : null}

      {!loading && works.length > 0 ? (
        <div className="folder-toolbar">
          <label className="folder-search">
            <span className="sr-only">Buscar ruta o fecha</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por ruta o fecha…"
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}

      {loading ? (
        <div className="folders-empty">
          <div className="folders-empty__spinner" />
          <p>Cargando trabajos publicados...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="folders-empty panel">
          <h3>
            {works.length === 0
              ? 'Sin trabajos publicados'
              : 'Sin coincidencias'}
          </h3>
          <p>
            {works.length === 0
              ? 'Este técnico aún no ha publicado fotos en esta actividad.'
              : 'Prueba con otro código de ruta o fecha.'}
          </p>
        </div>
      ) : (
        <div className="folders-grid">
          {filtered.map((work) => (
            <article
              key={`${work.folderId}-${work.dateId}`}
              className={`folder-tile folder-tile--clickable folder-tile--${folderTone(workFolderTitle(work))}`}
              role="link"
              tabIndex={0}
              aria-label={`Abrir ${workLabel(work)}`}
              onClick={() =>
                navigate(
                  `/carpetas/${work.folderId}/fechas/${work.dateId}?tecnico=${work.technicianId}&area=${areaId}`,
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(
                    `/carpetas/${work.folderId}/fechas/${work.dateId}?tecnico=${work.technicianId}&area=${areaId}`,
                  )
                }
              }}
            >
              <div className="folder-tile__top">
                <div className="folder-tile__icon" aria-hidden="true">
                  <IconFolder />
                </div>
                <div className="folder-tile__copy">
                  <div className="folder-tile__title-row">
                    <h3>{workLabel(work)}</h3>
                    <span className="folder-tile__open-hint">
                      Abrir
                      <IconChevron />
                    </span>
                  </div>
                  <p>
                    Publicada el{' '}
                    {work.publishedAt.toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="folder-tile__meta">
                <span className="activity-work-badge">Publicada</span>
                <span className="folder-meta-chip">
                  <IconImage />
                  {work.imageCount} foto
                  {work.imageCount === 1 ? '' : 's'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
