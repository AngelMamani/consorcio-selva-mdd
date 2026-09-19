import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Area } from '@/domain/entities/Area'
import { isSupplyImprovementArea } from '@/domain/entities/Area'
import { DomainError } from '@/domain/errors/DomainError'
import {
  canSaveImagesToFolder,
  clearDateStampCaches,
  clampNormRect,
  DEFAULT_DATE_COVER_RECT,
  exportDateStampImage,
  formatStampDate,
  renderDateStampPreview,
  saveEditedImagesToFolder,
  zipEditedImages,
  type DateStampEdit,
  type NormRect,
} from '@/infrastructure/images/photoDateStampEditor'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError, swalSuccess } from '@/presentation/utils/appSwal'
import './LocalFolderPhotoEditPage.css'

type LocalPhoto = {
  id: string
  name: string
  file: File
  previewUrl: string
}

type DragMode = 'move' | 'resize-se' | null

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z"
      />
    </svg>
  )
}

export function LocalFolderPhotoEditPage() {
  const { areaId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getAreaUseCase } = useDependencies()

  const folderInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragModeRef = useRef<DragMode>(null)
  const dragStartRef = useRef<{
    pointerX: number
    pointerY: number
    rect: NormRect
  } | null>(null)

  const [area, setArea] = useState<Area | null>(null)
  const [loadingArea, setLoadingArea] = useState(true)
  const [rootName, setRootName] = useState('')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, DateStampEdit>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [showCoverGuide, setShowCoverGuide] = useState(true)

  useEffect(() => {
    if (!user || !areaId) return
    let cancelled = false
    setLoadingArea(true)
    void (async () => {
      try {
        const next = await getAreaUseCase.execute(user, areaId)
        if (cancelled) return
        if (!isSupplyImprovementArea(next)) {
          navigate(`/areas/${areaId}/tecnicos`, { replace: true })
          return
        }
        setArea(next)
      } catch (error) {
        if (!cancelled) {
          swalError(
            error instanceof DomainError
              ? error.message
              : 'No se pudo cargar la actividad',
          )
        }
      } finally {
        if (!cancelled) setLoadingArea(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, areaId, getAreaUseCase, navigate])

  useEffect(() => {
    return () => {
      for (const photo of photos) URL.revokeObjectURL(photo.previewUrl)
    }
  }, [photos])

  const activePhoto = useMemo(
    () => photos.find((photo) => photo.id === activeId) ?? photos[0] ?? null,
    [photos, activeId],
  )

  const activeEdit = useMemo(() => {
    if (!activePhoto) return null
    return (
      edits[activePhoto.id] ?? {
        dateText: formatStampDate(),
        coverRect: { ...DEFAULT_DATE_COVER_RECT },
      }
    )
  }, [activePhoto, edits])

  const refreshPreview = useCallback(async (photo: LocalPhoto, edit: DateStampEdit) => {
    try {
      const url = await renderDateStampPreview(photo.file, edit)
      setPreviewUrl(url)
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo previsualizar la foto',
      )
    }
  }, [])

  useEffect(() => {
    if (!activePhoto || !activeEdit) {
      setPreviewUrl(null)
      return
    }
    // Texto: debounce corto (usa caché del fondo). Zona: un poco más lento.
    const delay = dragModeRef.current ? 220 : 90
    const handle = window.setTimeout(() => {
      void refreshPreview(activePhoto, activeEdit)
    }, delay)
    return () => window.clearTimeout(handle)
  }, [activePhoto, activeEdit, refreshPreview])

  function updateActiveEdit(partial: Partial<DateStampEdit>) {
    if (!activePhoto) return
    setEdits((current) => {
      const previous =
        current[activePhoto.id] ?? {
          dateText: formatStampDate(),
          coverRect: { ...DEFAULT_DATE_COVER_RECT },
        }
      return {
        ...current,
        [activePhoto.id]: {
          dateText: partial.dateText ?? previous.dateText,
          coverRect: clampNormRect(
            partial.coverRect ?? previous.coverRect,
          ),
        },
      }
    })
  }

  function clearFolder() {
    for (const photo of photos) URL.revokeObjectURL(photo.previewUrl)
    clearDateStampCaches()
    setPhotos([])
    setRootName('')
    setActiveId(null)
    setEdits({})
    setPreviewUrl(null)
    setStatus('')
  }

  function handlePickFolder(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    for (const photo of photos) URL.revokeObjectURL(photo.previewUrl)
    clearDateStampCaches()

    let root = 'Carpeta local'
    const next: LocalPhoto[] = []
    for (const file of Array.from(fileList)) {
      if (!IMAGE_EXT.test(file.name) && !file.type.startsWith('image/')) continue
      const full =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name
      const parts = full.split('/').filter(Boolean)
      if (parts.length > 1) root = parts[0]
      next.push({
        id: `${full}-${file.size}-${file.lastModified}`,
        name: file.name,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    next.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))

    const initialEdits: Record<string, DateStampEdit> = {}
    for (const photo of next) {
      initialEdits[photo.id] = {
        dateText: formatStampDate(),
        coverRect: { ...DEFAULT_DATE_COVER_RECT },
      }
    }

    setRootName(root)
    setPhotos(next)
    setEdits(initialEdits)
    setActiveId(next[0]?.id ?? null)
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  function onCoverPointerDown(
    event: ReactPointerEvent,
    mode: DragMode,
  ) {
    if (!activeEdit || !mode) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    dragModeRef.current = mode
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      rect: { ...activeEdit.coverRect },
    }
  }

  function onCoverPointerMove(event: ReactPointerEvent) {
    const mode = dragModeRef.current
    const start = dragStartRef.current
    const stage = stageRef.current
    if (!mode || !start || !stage) return

    const bounds = stage.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return
    const dx = (event.clientX - start.pointerX) / bounds.width
    const dy = (event.clientY - start.pointerY) / bounds.height

    if (mode === 'move') {
      updateActiveEdit({
        coverRect: {
          ...start.rect,
          x: start.rect.x + dx,
          y: start.rect.y + dy,
        },
      })
      return
    }

    updateActiveEdit({
      coverRect: {
        ...start.rect,
        w: start.rect.w + dx,
        h: start.rect.h + dy,
      },
    })
  }

  function onCoverPointerUp() {
    dragModeRef.current = null
    dragStartRef.current = null
  }

  async function saveCurrent() {
    if (!activePhoto || !activeEdit) return
    setBusy(true)
    setStatus('Guardando foto...')
    try {
      const result = await exportDateStampImage(activePhoto.file, activeEdit)
      const savePicker = (
        window as Window & {
          showSaveFilePicker?: (options?: {
            suggestedName?: string
            types?: Array<{
              description: string
              accept: Record<string, string[]>
            }>
          }) => Promise<FileSystemFileHandle>
        }
      ).showSaveFilePicker

      if (savePicker) {
        try {
          const handle = await savePicker({
            suggestedName: result.fileName,
            types: [
              {
                description: 'Imagen JPEG',
                accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(result.blob)
          await writable.close()
          swalSuccess('Foto guardada')
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
        }
      }

      downloadBlob(result.blob, result.fileName)
      swalSuccess('Foto descargada')
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo guardar la foto',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function saveAll() {
    if (photos.length === 0) return
    setBusy(true)
    try {
      const items = photos.map((photo) => ({
        file: photo.file,
        edit:
          edits[photo.id] ?? {
            dateText: formatStampDate(),
            coverRect: { ...DEFAULT_DATE_COVER_RECT },
          },
      }))
      const folderLabel = `${rootName || area?.name || 'mejoramiento'}-fotos-editadas`

      if (canSaveImagesToFolder()) {
        try {
          const result = await saveEditedImagesToFolder(
            items,
            folderLabel,
            setStatus,
          )
          swalSuccess(
            `${result.count} foto(s) guardadas en “${result.folderName}”`,
          )
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
        }
      }

      setStatus('Preparando ZIP...')
      const zip = await zipEditedImages(items, folderLabel, setStatus)
      downloadBlob(zip.blob, zip.fileName)
      swalSuccess(`ZIP con ${items.length} foto(s) descargado`)
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudieron guardar las fotos',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  if (loadingArea) {
    return (
      <section className="photo-edit-page">
        <p className="photo-edit-page__muted">Cargando actividad...</p>
      </section>
    )
  }

  if (!area) {
    return (
      <section className="photo-edit-page">
        <p className="photo-edit-page__muted">Actividad no encontrada.</p>
        <Link to="/areas" className="btn btn--soft-muted">
          Volver a actividades
        </Link>
      </section>
    )
  }

  const cover = activeEdit?.coverRect

  return (
    <section className="photo-edit-page">
      <div className="photo-edit-page__top">
        <Link to="/areas" className="photo-edit-page__back">
          <IconBack />
          Actividades
        </Link>
      </div>

      <header className="photo-edit-hero">
        <div>
          <p className="photo-edit-page__eyebrow">
            Mejoramiento de suministro · admin
          </p>
          <h2>{area.name}</h2>
          <p>
            Abre la carpeta de fotos. En cada imagen puedes{' '}
            <strong>borrar solo la fecha</strong> del sello y escribir una
            nueva. El resto del texto se mantiene.
          </p>
        </div>
        <div className="photo-edit-hero__actions">
          <label className={`btn btn--soft-primary ${busy ? 'is-busy' : ''}`}>
            <IconFolder />
            {rootName ? 'Cambiar carpeta' : 'Seleccionar carpeta'}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              disabled={busy}
              accept="image/*"
              onChange={(event) => handlePickFolder(event.target.files)}
              {...({
                webkitdirectory: '',
                directory: '',
              } as Record<string, string>)}
            />
          </label>
          {rootName ? (
            <button
              type="button"
              className="btn btn--soft-muted"
              disabled={busy}
              onClick={clearFolder}
            >
              Quitar carpeta
            </button>
          ) : null}
          {photos.length > 0 ? (
            <button
              type="button"
              className="btn btn--soft-teal"
              disabled={busy}
              onClick={() => void saveAll()}
            >
              <IconFolder />
              {busy && status
                ? status
                : `Guardar todas (${photos.length})`}
            </button>
          ) : null}
        </div>
      </header>

      {!rootName ? (
        <div className="photo-edit-empty panel">
          <IconFolder />
          <h3>Selecciona la carpeta de fotos</h3>
          <p>
            Cada foto puede tener una fecha distinta. Ajusta el recuadro sobre
            la fecha vieja y escribe la nueva.
          </p>
        </div>
      ) : (
        <div className="photo-edit-layout">
          <aside className="photo-edit-gallery panel">
            <div className="photo-edit-gallery__head">
              <strong>{rootName}</strong>
              <span>
                {photos.length} foto{photos.length === 1 ? '' : 's'}
              </span>
            </div>
            {photos.length === 0 ? (
              <p className="photo-edit-page__muted">
                No hay imágenes JPG/PNG/WebP en esta carpeta.
              </p>
            ) : (
              <div className="photo-edit-gallery__grid">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={`photo-edit-thumb${activePhoto?.id === photo.id ? ' is-active' : ''}`}
                    disabled={busy}
                    onClick={() => setActiveId(photo.id)}
                  >
                    <img src={photo.previewUrl} alt={photo.name} />
                    <span title={photo.name}>{photo.name}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div className="photo-edit-workspace panel">
            {activePhoto && activeEdit && cover ? (
              <>
                <div className="photo-edit-workspace__head">
                  <div>
                    <h3>{activePhoto.name}</h3>
                    <p>
                      Arrastra el recuadro para tapar la fecha vieja. Usa la
                      esquina para redimensionar.
                    </p>
                  </div>
                  <label className="photo-edit-guide-toggle">
                    <input
                      type="checkbox"
                      checked={showCoverGuide}
                      onChange={(event) =>
                        setShowCoverGuide(event.target.checked)
                      }
                    />
                    Mostrar zona de borrado
                  </label>
                </div>

                <label className="field photo-edit-date-field">
                  <span>Nueva fecha (esta foto)</span>
                  <input
                    value={activeEdit.dateText}
                    disabled={busy}
                    onChange={(event) =>
                      updateActiveEdit({ dateText: event.target.value })
                    }
                    placeholder="17 set. 2026 14:49:39"
                  />
                </label>
                <div className="photo-edit-date-actions">
                  <button
                    type="button"
                    className="btn btn--soft-primary"
                    disabled={busy}
                    onClick={() => void saveCurrent()}
                  >
                    {busy && status ? status : 'Guardar esta foto'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--soft-muted btn--small"
                    disabled={busy}
                    onClick={() =>
                      updateActiveEdit({ dateText: formatStampDate() })
                    }
                  >
                    Usar ahora
                  </button>
                  <button
                    type="button"
                    className="btn btn--soft-muted btn--small"
                    disabled={busy}
                    onClick={() =>
                      updateActiveEdit({
                        coverRect: { ...DEFAULT_DATE_COVER_RECT },
                      })
                    }
                  >
                    Reset zona
                  </button>
                </div>

                <div
                  ref={stageRef}
                  className="photo-edit-stage"
                  onPointerMove={onCoverPointerMove}
                  onPointerUp={onCoverPointerUp}
                  onPointerCancel={onCoverPointerUp}
                >
                  {previewUrl ? (
                    <img
                      className="photo-edit-stage__image"
                      src={previewUrl}
                      alt={`Preview ${activePhoto.name}`}
                    />
                  ) : (
                    <img
                      className="photo-edit-stage__image"
                      src={activePhoto.previewUrl}
                      alt={activePhoto.name}
                    />
                  )}
                  {showCoverGuide ? (
                    <div
                      className="photo-edit-cover"
                      style={{
                        left: `${cover.x * 100}%`,
                        top: `${cover.y * 100}%`,
                        width: `${cover.w * 100}%`,
                        height: `${cover.h * 100}%`,
                      }}
                      onPointerDown={(event) =>
                        onCoverPointerDown(event, 'move')
                      }
                    >
                      <span className="photo-edit-cover__label">Fecha</span>
                      <button
                        type="button"
                        className="photo-edit-cover__handle"
                        aria-label="Redimensionar zona"
                        onPointerDown={(event) =>
                          onCoverPointerDown(event, 'resize-se')
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="photo-edit-page__muted">
                Elige una foto de la galería.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
