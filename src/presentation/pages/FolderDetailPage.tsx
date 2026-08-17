import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { FolderDate } from '@/domain/entities/FolderDate'
import { formatDateKey, toDateKey } from '@/domain/entities/FolderDate'
import type { FolderImage } from '@/domain/entities/FolderImage'
import { formatFolderAssignees } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { hasGeoLocation } from '@/domain/value-objects/GeoLocation'
import { UserRole } from '@/domain/value-objects/UserRole'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import { StorageImage } from '@/presentation/components/StorageImage'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './FolderDetailPage.css'

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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-hero__glyph">
      <path
        fill="currentColor"
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z"
      />
    </svg>
  )
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-chip__icon">
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4"
      />
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-chip__icon">
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5"
      />
    </svg>
  )
}

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-chip__icon">
      <path
        fill="currentColor"
        d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z"
      />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-chip__icon">
      <path
        fill="currentColor"
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
      />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 16H5V10h14zm0-12H5V6h14z"
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

function IconEmpty() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-empty__icon">
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 16H5V10h14z"
      />
    </svg>
  )
}

export function FolderDetailPage() {
  const { folderId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    getFolderUseCase,
    listFolderDatesUseCase,
    createFolderDateUseCase,
    deleteFolderDateUseCase,
    listFolderImagesUseCase,
    deleteFolderImageUseCase,
  } = useDependencies()

  const [folder, setFolder] = useState<ImageFolder | null>(null)
  const [dates, setDates] = useState<FolderDate[]>([])
  const [legacyImages, setLegacyImages] = useState<FolderImage[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [dateKey, setDateKey] = useState(toDateKey(new Date()))
  const [dateNote, setDateNote] = useState('')

  const isAdmin = user?.role === UserRole.Administrador

  async function loadData() {
    if (!user || !folderId) return
    setLoading(true)
    try {
      const folderData = await getFolderUseCase.execute(user, folderId)
      setFolder(folderData)

      const [dateResult, imageResult] = await Promise.allSettled([
        listFolderDatesUseCase.execute(user, folderId),
        listFolderImagesUseCase.execute(user, folderId),
      ])

      if (dateResult.status === 'fulfilled') {
        setDates(dateResult.value)
      } else {
        setDates([])
        console.error('Error al cargar fechas', dateResult.reason)
        swalError(
          dateResult.reason instanceof DomainError
            ? dateResult.reason.message
            : 'No se pudieron cargar las fechas de esta carpeta',
        )
      }

      if (imageResult.status === 'fulfilled') {
        setLegacyImages(imageResult.value.filter((image) => !image.dateId))
      } else {
        setLegacyImages([])
        console.error('Error al cargar imágenes', imageResult.reason)
      }
    } catch (err) {
      setFolder(null)
      swalError(
        err instanceof DomainError ? err.message : 'Error al cargar carpeta',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, folderId])

  async function handleCreateDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !folderId || submitting) return

    setSubmitting(true)
    setShowDateModal(false)
    swalSuccess('Fecha creada')

    try {
      const created = await createFolderDateUseCase.execute(user, {
        folderId,
        dateKey,
        note: dateNote,
      })
      setDates((current) =>
        [...current, created].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
      )
      setDateNote('')
      setDateKey(toDateKey(new Date()))
      navigate(`/carpetas/${folderId}/fechas/${created.id}`)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo crear la fecha',
      )
      setShowDateModal(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDeleteDate(folderDate: FolderDate) {
    if (!user || !isAdmin || submitting) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar fecha?',
      text: `"${formatDateKey(folderDate.dateKey)}" y todas sus imágenes se eliminarán.`,
    })
    if (!confirmed) return

    setDates((current) => current.filter((item) => item.id !== folderDate.id))
    swalSuccess('Fecha eliminada')
    try {
      await deleteFolderDateUseCase.execute(user, folderId, folderDate.id)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo eliminar',
      )
      await loadData()
    }
  }

  async function confirmDeleteLegacyImage(image: FolderImage) {
    if (!user || !folderId || !isAdmin || submitting) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar imagen?',
      text: `"${image.fileName}" se eliminará. Esta acción no se puede deshacer.`,
    })
    if (!confirmed) return

    setLegacyImages((current) => current.filter((item) => item.id !== image.id))
    swalSuccess('Imagen eliminada')
    try {
      await deleteFolderImageUseCase.execute(user, folderId, image.id)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo eliminar',
      )
      await loadData()
    }
  }

  if (loading) {
    return (
      <div className="folder-detail-empty">
        <div className="folder-detail-empty__spinner" />
        <p>Cargando carpeta...</p>
      </div>
    )
  }

  if (!folder) {
    return (
      <div className="folder-detail-empty panel">
        <p>Carpeta no encontrada</p>
        <Link to="/areas" className="btn btn--soft-muted">
          <IconBack />
          Volver a áreas
        </Link>
      </div>
    )
  }

  const backToFolders = folder.areaId
    ? `/areas/${folder.areaId}/carpetas`
    : '/areas'

  return (
    <section className="folder-detail-page">
      <div className="folder-detail-top">
        <Link to={backToFolders} className="folder-detail-back">
          <IconBack />
          {folder.areaName || 'Carpetas'}
        </Link>
      </div>

      <header className="folder-detail-hero">
        <div className="folder-detail-hero__main">
          <div className="folder-detail-hero__icon" aria-hidden="true">
            <IconFolder />
          </div>
          <div className="folder-detail-hero__copy">
            <p className="folder-detail-page__eyebrow">Carpeta</p>
            <h2>{folder.name}</h2>
            <p className="folder-detail-hero__desc">
              {folder.description || 'Sin descripción'}
            </p>
            <div className="folder-detail-hero__chips">
              <span className="folder-detail-chip">
                <IconPerson />
                {formatFolderAssignees(folder)}
              </span>
              <span className="folder-detail-chip">
                <IconClock />
                {dates.length} fecha{dates.length === 1 ? '' : 's'}
              </span>
              <span className="folder-detail-chip">
                <IconImage />
                {folder.imageCount} imagen
                {folder.imageCount === 1 ? '' : 'es'}
              </span>
              {folder.location && hasGeoLocation(folder.location) ? (
                <span className="folder-detail-chip">
                  <IconPin />
                  GPS {folder.location.latitude.toFixed(5)},{' '}
                  {folder.location.longitude.toFixed(5)}
                  <Link
                    to={`/mapa?folder=${folder.id}`}
                    className="folder-detail-chip__link"
                  >
                    Ver mapa
                  </Link>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="folder-detail-hero__actions">
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={() => {
              setDateKey(toDateKey(new Date()))
              setDateNote('')
              setShowDateModal(true)
            }}
          >
            <IconCalendar />
            Nueva fecha
          </button>
        </div>
      </header>

      {dates.length === 0 ? (
        <div className="folder-detail-empty panel">
          <IconEmpty />
          <h3>Crea una fecha para subir fotos</h3>
          <p>
            Las imágenes van dentro de una carpeta de fecha. Crea el día de
            trabajo y luego sube las fotos ahí.
          </p>
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={() => setShowDateModal(true)}
          >
            <IconCalendar />
            Nueva fecha
          </button>
        </div>
      ) : (
        <div className="folder-dates-grid">
          {dates.map((item) => (
            <article
              key={item.id}
              className="folder-date-card"
              role="link"
              tabIndex={0}
              onClick={() =>
                navigate(`/carpetas/${folderId}/fechas/${item.id}`)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/carpetas/${folderId}/fechas/${item.id}`)
                }
              }}
            >
              <div className="folder-date-card__icon" aria-hidden="true">
                <IconCalendar />
              </div>
              <div className="folder-date-card__copy">
                <h3>{formatDateKey(item.dateKey)}</h3>
                <p>{item.note || 'Sin nota'}</p>
                <span>
                  {item.imageCount} imagen{item.imageCount === 1 ? '' : 'es'} ·{' '}
                  {item.createdByName}
                </span>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  className="btn btn--icon-only btn--soft-rose"
                  title="Eliminar fecha"
                  onClick={(event) => {
                    event.stopPropagation()
                    void confirmDeleteDate(item)
                  }}
                >
                  <IconTrash />
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {legacyImages.length > 0 ? (
        <section className="folder-legacy">
          <h3>Imágenes sin fecha</h3>
          <p>
            Fotos antiguas de esta carpeta. Las nuevas se suben dentro de una
            fecha.
          </p>
          <div className="folder-photo-grid">
            {legacyImages.map((image) => (
              <article key={image.id} className="folder-photo">
                <StorageImage
                  className="folder-photo__media"
                  storagePath={image.storagePath}
                  alt={image.fileName}
                  openOnClick
                />
                <div className="folder-photo__body">
                  <strong title={image.fileName}>{image.fileName}</strong>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="btn btn--soft-rose btn--small"
                      onClick={() => void confirmDeleteLegacyImage(image)}
                    >
                      <IconTrash />
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <AppModal
        open={showDateModal}
        title="Nueva fecha"
        description="Elige el día de trabajo. Las fotos se suben dentro de esta fecha."
        onClose={() => {
          if (!submitting) setShowDateModal(false)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setShowDateModal(false)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="folder-date-form"
              className="btn btn--soft-primary"
              disabled={submitting}
            >
              <IconCalendar />
              Crear fecha
            </button>
          </>
        }
      >
        <form
          id="folder-date-form"
          className="login-form"
          onSubmit={handleCreateDate}
        >
          <label className="field">
            <span>Fecha</span>
            <input
              type="date"
              value={dateKey}
              onChange={(event) => setDateKey(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Nota (opcional)</span>
            <input
              value={dateNote}
              onChange={(event) => setDateNote(event.target.value)}
              placeholder="Ej. Inspección sector 2"
              maxLength={200}
            />
          </label>
        </form>
      </AppModal>
    </section>
  )
}
