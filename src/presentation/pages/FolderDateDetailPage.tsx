import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { FolderDate } from '@/domain/entities/FolderDate'
import { formatDateKey } from '@/domain/entities/FolderDate'
import type { FolderImage } from '@/domain/entities/FolderImage'
import { DomainError } from '@/domain/errors/DomainError'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'
import { formatRouteCode } from '@/domain/services/SupplySearchService'
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
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

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-hero__glyph">
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 16H5V10h14zm0-12H5V6h14z"
      />
    </svg>
  )
}

function IconPdf() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5zm4-1H19v1h1.5V11H19v1h-1.5V7h3zM9 9.5h1v-1H9zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm11 5.5h1v-3h-1z"
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

function IconExpand() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-photo__expand">
      <path
        fill="currentColor"
        d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"
      />
    </svg>
  )
}

function IconEmpty() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-empty__icon">
      <path
        fill="currentColor"
        d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z"
      />
    </svg>
  )
}

export function FolderDateDetailPage() {
  const { folderId = '', dateId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const technicianId = searchParams.get('tecnico')?.trim() || ''
  const areaFromQuery = searchParams.get('area')?.trim() || ''
  const { user } = useAuth()
  const {
    getFolderDateUseCase,
    listFolderImagesUseCase,
    uploadFolderImageUseCase,
    deleteFolderImageUseCase,
    exportFolderImagesToPdfUseCase,
  } = useDependencies()

  const [folder, setFolder] = useState<ImageFolder | null>(null)
  const [folderDate, setFolderDate] = useState<FolderDate | null>(null)
  const [images, setImages] = useState<FolderImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfName, setPdfName] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfStatus, setPdfStatus] = useState('')

  const isAdmin = Boolean(user && canManageUsers(user.role))
  const reviewTechnician = Boolean(technicianId)

  async function loadData() {
    if (!user || !folderId || !dateId) return
    setLoading(true)
    try {
      const { folder: folderData, folderDate: dateData } =
        await getFolderDateUseCase.execute(user, folderId, dateId)
      setFolder(folderData)
      setFolderDate(dateData)

      try {
        const imageData = await listFolderImagesUseCase.execute(
          user,
          folderId,
          dateId,
          technicianId || undefined,
        )
        setImages(imageData)
      } catch (err) {
        setImages([])
        console.error('Error al cargar imágenes de la fecha', err)
      }
    } catch (err) {
      setFolder(null)
      setFolderDate(null)
      swalError(
        err instanceof DomainError ? err.message : 'Error al cargar la fecha',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, folderId, dateId, technicianId])

  function openPdfModal() {
    if (!folder || !folderDate) return
    const routeLabel = folder.routeCode
      ? formatRouteCode(folder.routeCode)
      : folder.name
    const techName = images[0]?.uploadedByName
    setPdfName(
      [techName, routeLabel, folderDate.dateKey].filter(Boolean).join(' '),
    )
    setShowPdfModal(true)
  }

  async function handleExportPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !folderId || !dateId) return

    setExportingPdf(true)
    setPdfStatus('Preparando PDF...')

    try {
      setPdfStatus('Convirtiendo imágenes...')
      const result = await exportFolderImagesToPdfUseCase.execute(
        user,
        folderId,
        pdfName,
        dateId,
        technicianId || undefined,
      )
      downloadBlob(result.blob, result.fileName)
      setShowPdfModal(false)
      swalSuccess('PDF exportado')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo generar el PDF',
      )
    } finally {
      setExportingPdf(false)
      setPdfStatus('')
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!user || !folderId || !dateId) return
    const files = event.target.files
    if (!files || files.length === 0) return

    const selected = Array.from(files)
    setUploading(true)

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index]
        setUploadProgress(`Subiendo ${index + 1} de ${selected.length}...`)
        await uploadFolderImageUseCase.execute(user, folderId, dateId, {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          data: file,
        })
      }
      swalSuccess(
        selected.length === 1
          ? 'Imagen subida'
          : `${selected.length} imágenes subidas`,
      )
      await loadData()
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo subir la imagen',
      )
    } finally {
      setUploading(false)
      setUploadProgress('')
      event.target.value = ''
    }
  }

  async function confirmDeleteImage(image: FolderImage) {
    if (!user || !folderId || !isAdmin || deleting) return

    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar imagen?',
      text: `"${image.fileName}" se eliminará. Esta acción no se puede deshacer.`,
    })
    if (!confirmed) return

    setDeleting(true)
    setImages((current) => current.filter((item) => item.id !== image.id))
    setFolderDate((current) =>
      current
        ? { ...current, imageCount: Math.max(0, current.imageCount - 1) }
        : current,
    )
    swalSuccess('Imagen eliminada')
    try {
      await deleteFolderImageUseCase.execute(user, folderId, image.id, dateId)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo eliminar',
      )
      await loadData()
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="folder-detail-empty">
        <div className="folder-detail-empty__spinner" />
        <p>Cargando fecha...</p>
      </div>
    )
  }

  if (!folder || !folderDate) {
    return (
      <div className="folder-detail-empty panel">
        <p>Fecha no encontrada</p>
        <Link
          to={
            technicianId
              ? `/areas/${areaFromQuery}/tecnicos/${technicianId}`
              : folderId
                ? `/carpetas/${folderId}`
                : '/areas'
          }
          className="btn btn--soft-muted"
        >
          <IconBack />
          Volver a la carpeta
        </Link>
      </div>
    )
  }

  const backTo = reviewTechnician
    ? `/areas/${areaFromQuery || folder.areaId}/tecnicos/${technicianId}`
    : `/carpetas/${folderId}`
  const backLabel = reviewTechnician
    ? images[0]?.uploadedByName || 'Técnico'
    : folder.name
  const routeLabel = folder.routeCode
    ? formatRouteCode(folder.routeCode)
    : folder.name
  const previewPdfName = sanitizePdfFileName(pdfName || folder.name)
  const totalBytes = images.reduce((sum, image) => sum + image.sizeBytes, 0)

  return (
    <section className="folder-detail-page">
      <div className="folder-detail-top">
        <Link to={backTo} className="folder-detail-back">
          <IconBack />
          {backLabel}
        </Link>
      </div>

      <header className="folder-detail-hero">
        <div className="folder-detail-hero__main">
          <div className="folder-detail-hero__icon" aria-hidden="true">
            <IconCalendar />
          </div>
          <div className="folder-detail-hero__copy">
            <p className="folder-detail-page__eyebrow">
              {reviewTechnician ? 'Trabajo publicado' : 'Carpeta de fecha'}
            </p>
            <h2>
              {reviewTechnician
                ? `${routeLabel} · ${formatDateKey(folderDate.dateKey)}`
                : formatDateKey(folderDate.dateKey)}
            </h2>
            <p className="folder-detail-hero__desc">
              {folderDate.note ||
                (reviewTechnician
                  ? 'Fotos del trabajo en esta ruta y fecha.'
                  : 'Sin nota')}
            </p>
            <div className="folder-detail-hero__chips">
              <span className="folder-detail-chip">
                <IconImage />
                {images.length} imagen{images.length === 1 ? '' : 'es'}
              </span>
              <span className="folder-detail-chip">
                <IconClock />
                {reviewTechnician
                  ? `Publicada ${formatDateTime(folderDate.updatedAt)}`
                  : `Creada ${formatDateTime(folderDate.createdAt)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="folder-detail-hero__actions">
          {isAdmin ? (
            <button
              type="button"
              className="btn btn--soft-teal"
              onClick={openPdfModal}
              disabled={images.length === 0 || uploading || exportingPdf}
            >
              <IconPdf />
              Convertir a PDF
            </button>
          ) : null}
          {reviewTechnician ? null : (
            <label
              className={`btn btn--soft-primary ${uploading ? 'is-busy' : ''}`}
            >
              <IconUpload />
              {uploading ? uploadProgress || 'Subiendo...' : 'Subir imágenes'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                disabled={uploading}
                onChange={(event) => void handleUpload(event)}
              />
            </label>
          )}
        </div>
      </header>

      <div className="folder-detail-summary" aria-label="Resumen">
        <div className="folder-detail-summary__item">
          <strong>{images.length}</strong>
          <span>en galería</span>
        </div>
        <div className="folder-detail-summary__item">
          <strong>{formatBytes(totalBytes)}</strong>
          <span>peso total</span>
        </div>
        <div className="folder-detail-summary__item">
          <strong>{folderDate.createdByName}</strong>
          <span>creada por</span>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="folder-detail-empty panel">
          <IconEmpty />
          <h3>Esta fecha no tiene fotos</h3>
          <p>Sube las imágenes de este día de trabajo.</p>
          <label className={`btn btn--soft-primary ${uploading ? 'is-busy' : ''}`}>
            <IconUpload />
            {uploading ? uploadProgress || 'Subiendo...' : 'Subir imágenes'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              disabled={uploading}
              onChange={(event) => void handleUpload(event)}
            />
          </label>
        </div>
      ) : (
        <div className="folder-photo-grid">
          {images.map((image) => (
            <article key={image.id} className="folder-photo">
              <StorageImage
                className="folder-photo__media"
                storagePath={image.storagePath}
                alt={image.fileName}
                openOnClick
                overlay={
                  <span className="folder-photo__overlay">
                    <IconExpand />
                    Ver grande
                  </span>
                }
              />
              <div className="folder-photo__body">
                <strong title={image.fileName}>{image.fileName}</strong>
                <div className="folder-photo__meta">
                  <span>{formatBytes(image.sizeBytes)}</span>
                  <span>{image.uploadedByName}</span>
                  <span>{formatDateTime(image.createdAt)}</span>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    className="btn btn--soft-rose btn--small"
                    onClick={() => void confirmDeleteImage(image)}
                  >
                    <IconTrash />
                    Eliminar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <AppModal
        open={showPdfModal}
        title="Convertir a PDF"
        description="Elige el nombre del archivo antes de descargarlo."
        onClose={() => {
          if (!exportingPdf) setShowPdfModal(false)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setShowPdfModal(false)}
              disabled={exportingPdf}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pdf-export-form"
              className="btn btn--soft-primary"
              disabled={exportingPdf || !pdfName.trim()}
            >
              <IconPdf />
              {exportingPdf ? pdfStatus || 'Generando...' : 'Generar y descargar'}
            </button>
          </>
        }
      >
        <form
          id="pdf-export-form"
          className="login-form"
          onSubmit={handleExportPdf}
        >
          <label className="field">
            <span>Nombre del PDF</span>
            <input
              value={pdfName}
              onChange={(event) => setPdfName(event.target.value)}
              placeholder="Ej: Informe campo 17-08-2026"
              required
              disabled={exportingPdf}
            />
          </label>
          <p className="pdf-name-hint">
            Se guardará como: <strong>{previewPdfName}</strong>
          </p>
          <p className="pdf-name-hint">
            Incluye {images.length} imagen(es) de esta fecha.
          </p>
        </form>
      </AppModal>
    </section>
  )
}
