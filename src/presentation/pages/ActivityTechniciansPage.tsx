import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Area } from '@/domain/entities/Area'
import type { ActivityTechnicianFolder } from '@/domain/entities/TechnicianActivityWork'
import { DomainError } from '@/domain/errors/DomainError'
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

function formatPublished(date: Date | null): string {
  if (!date) return 'Sin trabajos publicados'
  return `Último: ${date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`
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
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
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

export function ActivityTechniciansPage() {
  const { areaId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { listActivityPublishedWorkUseCase, getAreaUseCase } = useDependencies()

  const [area, setArea] = useState<Area | null>(null)
  const [technicians, setTechnicians] = useState<ActivityTechnicianFolder[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return technicians
    return technicians.filter((item) =>
      item.technicianName.toLowerCase().includes(query),
    )
  }, [technicians, deferredSearch])

  const publishedCount = technicians.filter((item) => item.workCount > 0).length

  useEffect(() => {
    if (!user || !areaId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [nextArea, result] = await Promise.all([
          getAreaUseCase.execute(user, areaId),
          listActivityPublishedWorkUseCase.execute(user, areaId),
        ])
        if (cancelled) return
        setArea(nextArea)
        setTechnicians(result.technicians)
      } catch (error) {
        if (!cancelled) {
          swalError(
            error instanceof DomainError
              ? error.message
              : 'No se pudieron cargar las carpetas de técnicos',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, areaId, getAreaUseCase, listActivityPublishedWorkUseCase])

  if (!user) return null

  return (
    <section className="folders-page activity-work-page">
      <div className="page-header">
        <div>
          <Link to="/areas" className="folders-page__back">
            <IconBack />
            Actividades
          </Link>
          <p className="folders-page__eyebrow">Actividad</p>
          <h1>{area?.name || 'Técnicos'}</h1>
          <p>
            Cada técnico tiene su carpeta. Dentro verás sus trabajos publicados
            (ruta + fecha) y las fotos para exportar a PDF.
          </p>
        </div>
        <Link
          to={`/areas/${areaId}/carpetas`}
          className="activity-work-catalog-link"
        >
          Catálogo de suministros
        </Link>
      </div>

      {!loading && technicians.length > 0 ? (
        <div className="folders-summary" aria-label="Resumen de técnicos">
          <div className="folders-summary__item">
            <strong>{technicians.length}</strong>
            <span>técnicos</span>
          </div>
          <div className="folders-summary__item">
            <strong>{publishedCount}</strong>
            <span>con trabajo publicado</span>
          </div>
          <div className="folders-summary__item">
            <strong>{filtered.length}</strong>
            <span>visibles</span>
          </div>
        </div>
      ) : null}

      {!loading && technicians.length > 0 ? (
        <div className="folder-toolbar">
          <label className="folder-search">
            <span className="sr-only">Buscar técnico</span>
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar técnico…"
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}

      {loading ? (
        <div className="folders-empty">
          <div className="folders-empty__spinner" />
          <p>Cargando carpetas de técnicos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="folders-empty panel">
          <h3>
            {technicians.length === 0
              ? 'Aún no hay técnicos'
              : 'Sin coincidencias'}
          </h3>
          <p>
            {technicians.length === 0
              ? 'Cuando un técnico publique fotos en esta actividad, su carpeta aparecerá aquí.'
              : 'Prueba con otro nombre.'}
          </p>
        </div>
      ) : (
        <div className="folders-grid">
          {filtered.map((technician) => (
            <article
              key={technician.technicianId}
              className={`folder-tile folder-tile--clickable folder-tile--${folderTone(technician.technicianName)}`}
              role="link"
              tabIndex={0}
              aria-label={`Abrir carpeta de ${technician.technicianName}`}
              onClick={() =>
                navigate(
                  `/areas/${areaId}/tecnicos/${technician.technicianId}`,
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(
                    `/areas/${areaId}/tecnicos/${technician.technicianId}`,
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
                    <h3>{technician.technicianName}</h3>
                    <span className="folder-tile__open-hint">
                      Abrir
                      <IconChevron />
                    </span>
                  </div>
                  <p>{formatPublished(technician.lastPublishedAt)}</p>
                </div>
              </div>
              <div className="folder-tile__meta">
                <span
                  className={
                    technician.workCount > 0
                      ? 'activity-work-badge'
                      : 'activity-work-badge activity-work-badge--empty'
                  }
                >
                  {technician.workCount > 0 ? 'Publicada' : 'Sin publicar'}
                </span>
                <span className="folder-meta-chip">
                  <IconPerson />
                  {technician.workCount} trabajo
                  {technician.workCount === 1 ? '' : 's'}
                </span>
                <span className="folder-meta-chip">
                  <IconImage />
                  {technician.imageCount} foto
                  {technician.imageCount === 1 ? '' : 's'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
