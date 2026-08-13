import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { FolderImage } from '@/domain/entities/FolderImage'
import { DomainError } from '@/domain/errors/DomainError'
import { hasGeoLocation } from '@/domain/value-objects/GeoLocation'
import { UserRole } from '@/domain/value-objects/UserRole'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import { StorageImage } from '@/presentation/components/StorageImage'
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

function wasFolderModified(folder: ImageFolder): boolean {
  return Math.abs(folder.updatedAt.getTime() - folder.createdAt.getTime()) > 60_000
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

function IconUpdated() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="folder-detail-chip__icon">
      <path
        fill="currentColor"
        d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6m6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26"
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
        d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z"
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

export function FolderDetailPage() {
  const { folderId = '' } = useParams()
  const { user } = useAuth()
  const {
    getFolderUseCase,
    listFolderImagesUseCase,
    uploadFolderImageUseCase,
    deleteFolderImageUseCase,
    exportFolderImagesToPdfUseCase,
  } = useDependencies()

  const [folder, setFolder] = useState<ImageFolder | null>(null)
  const [images, setImages] = useState<FolderImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [imageToDelete, setImageToDelete] = useState<FolderImage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfName, setPdfName] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfStatus, setPdfStatus] = useState('')

  const isAdmin = user?.role === UserRole.Administrador

  async function loadData() {
    if (!user || !folderId) return
    setLoading(true)
    setError(null)
    try {
      const [folderData, imageData] = await Promise.all([
        getFolderUseCase.execute(user, folderId),
        listFolderImagesUseCase.execute(user, folderId),
      ])
      setFolder(folderData)
      setImages(imageData)
    } catch (err) {
      setError(
        err instanceof DomainError ? err.message : 'Error al cargar carpeta',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [user, folderId])

  function openPdfModal() {
    if (!folder) return
    setPdfName(folder.name)
    setPdfStatus('')
    setError(null)
    setShowPdfModal(true)
  }

  async function handleExportPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !folderId) return

    setExportingPdf(true)
    setError(null)
    setPdfStatus('Preparando PDF...')

    try {
      setPdfStatus('Convirtiendo imágenes...')
      const result = await exportFolderImagesToPdfUseCase.execute(
        user,
        folderId,
        pdfName,
      )
      downloadBlob(result.blob, result.fileName)
      setShowPdfModal(false)
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo generar el PDF',
      )
    } finally {
      setExportingPdf(false)
      setPdfStatus('')
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!user || !folderId) return
    const files = event.target.files
    if (!files || files.length === 0) return

    const selected = Array.from(files)
    setUploading(true)
    setError(null)

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index]
        setUploadProgress(`Subiendo ${index + 1} de ${selected.length}...`)
        await uploadFolderImageUseCase.execute(user, folderId, {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          data: file,
        })
      }
      await loadData()
    } catch (err) {
      setError(
        err instanceof DomainError ? err.message : 'No se pudo subir la imagen',
      )
    } finally {
      setUploading(false)
      setUploadProgress('')
      event.target.value = ''
    }
  }

  async function handleDeleteConfirm() {
    if (!user || !folderId || !imageToDelete || !isAdmin) return
    setDeleting(true)
    setError(null)

    try {
      await deleteFolderImageUseCase.execute(user, folderId, imageToDelete.id)
      setImageToDelete(null)
      await loadData()
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'No se pudo eliminar')
    } finally {
      setDeleting(false)
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
        <p>{error ?? 'Carpeta no encontrada'}</p>
        <Link to="/carpetas" className="btn btn--soft-muted">
          <IconBack />
          Volver a carpetas
        </Link>
      </div>
    )
  }

  const previewPdfName = sanitizePdfFileName(pdfName || folder.name)
  const totalBytes = images.reduce((sum, image) => sum + image.sizeBytes, 0)

  return (
    <section className="folder-detail-page">
      <div className="folder-detail-top">
        <Link to="/carpetas" className="folder-detail-back">
          <IconBack />
          Carpetas
        </Link>
      </div>

      <header className="folder-detail-hero">
        <div className="folder-detail-hero__main">
          <div className="folder-detail-hero__icon" aria-hidden="true">
            <IconFolder />
          </div>
          <div className="folder-detail-hero__copy">
            <p className="folder-detail-page__eyebrow">Detalle de carpeta</p>
            <h2>{folder.name}</h2>
            <p className="folder-detail-hero__desc">
              {folder.description || 'Sin descripción'}
            </p>
            <div className="folder-detail-hero__chips">
              <span className="folder-detail-chip">
                <IconPerson />
                {folder.ownerName}
              </span>
              <span className="folder-detail-chip">
                <IconImage />
                {folder.imageCount} imagen
                {folder.imageCount === 1 ? '' : 'es'}
              </span>
              <span className="folder-detail-chip">
                <IconClock />
                Creada {formatDateTime(folder.createdAt)}
              </span>
              {wasFolderModified(folder) ? (
                <span className="folder-detail-chip folder-detail-chip--updated">
                  <IconUpdated />
                  Modificada {formatDateTime(folder.updatedAt)}
                </span>
              ) : null}
              {folder.location && hasGeoLocation(folder.location) ? (
                <span className="folder-detail-chip">
                  <IconPin />
                  GPS {folder.location.latitude.toFixed(5)},{' '}
                  {folder.location.longitude.toFixed(5)}
                  <Link to="/mapa" className="folder-detail-chip__link">
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
            className="btn btn--soft-teal"
            onClick={openPdfModal}
            disabled={images.length === 0 || uploading || exportingPdf}
          >
            <IconPdf />
            Convertir a PDF
          </button>
          <label
            className={`btn btn--soft-primary ${uploading ? 'is-busy' : ''}`}
          >
            <IconUpload />
            {uploading
              ? uploadProgress || 'Subiendo...'
              : 'Subir imágenes'}
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
          <strong>{folder.ownerName.split(' ')[0]}</strong>
          <span>responsable</span>
        </div>
      </div>

      {error && !showPdfModal ? (
        <p className="form-alert form-alert--error">{error}</p>
      ) : null}

      {images.length === 0 ? (
        <div className="folder-detail-empty panel">
          <IconEmpty />
          <h3>Esta carpeta está vacía</h3>
          <p>Sube las primeras fotos de campo para empezar a documentar.</p>
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
                    onClick={() => setImageToDelete(image)}
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
              placeholder="Ej: Informe campo sector A"
              required
              disabled={exportingPdf}
            />
          </label>
          <p className="pdf-name-hint">
            Se guardará como: <strong>{previewPdfName}</strong>
          </p>
          <p className="pdf-name-hint">
            Incluye {images.length} imagen(es) de esta carpeta.
          </p>
          {error && showPdfModal ? (
            <p className="form-alert form-alert--error">{error}</p>
          ) : null}
        </form>
      </AppModal>

      <AppModal
        open={imageToDelete !== null}
        title="Eliminar imagen"
        description="Esta acción no se puede deshacer."
        onClose={() => {
          if (!deleting) setImageToDelete(null)
        }}
        size="sm"
        danger
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setImageToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--soft-rose"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleting}
            >
              <IconTrash />
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </>
        }
      >
        <p>
          ¿Eliminar la imagen <strong>{imageToDelete?.fileName}</strong>?
        </p>
      </AppModal>
    </section>
  )
}
