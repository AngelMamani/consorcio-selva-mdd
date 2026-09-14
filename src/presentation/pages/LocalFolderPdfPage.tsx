import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Area } from '@/domain/entities/Area'
import { isAdminManagedFolderArea } from '@/domain/entities/Area'
import { DomainError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'
import {
  assembleClientPdf,
  canSavePdfsToFolder,
  discoverClientJobAtPath,
  discoverClientJobs,
  prepareClientJobs,
  savePreparedPdfsToFolder,
  zipPreparedPdfs,
  type ClientPdfPage,
  type PreparedClientPdf,
} from '@/infrastructure/pdf/clientFolderPdfBuilder'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError, swalSuccess } from '@/presentation/utils/appSwal'
import './LocalFolderPdfPage.css'

type LocalFileItem = {
  id: string
  name: string
  relativePath: string
  parentPath: string
  file: File
  previewUrl?: string
  kind: 'image' | 'pdf' | 'other'
}

type BrowserFolder = {
  name: string
  path: string
  childCount: number
}

type BrowserEntry =
  | { type: 'folder'; folder: BrowserFolder }
  | { type: 'file'; file: LocalFileItem }

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
const PDF_EXT = /\.pdf$/i

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

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function parentOf(relativePath: string): string {
  const idx = relativePath.lastIndexOf('/')
  return idx === -1 ? '' : relativePath.slice(0, idx)
}

function fileKind(name: string, type: string): LocalFileItem['kind'] {
  if (IMAGE_EXT.test(name)) return 'image'
  if (PDF_EXT.test(name) || type === 'application/pdf') return 'pdf'
  return 'other'
}

function buildLocalFiles(files: File[]): {
  rootName: string
  items: LocalFileItem[]
} {
  let rootName = 'Carpeta local'
  const items: LocalFileItem[] = []

  for (const file of files) {
    const full =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name
    const parts = full.split('/').filter(Boolean)
    if (parts.length === 0) continue
    if (parts.length > 1) rootName = parts[0]
    const relativePath =
      parts.length === 1 ? parts[0] : parts.slice(1).join('/')
    const kind = fileKind(file.name, file.type)
    items.push({
      id: `${full}-${file.size}-${file.lastModified}`,
      name: file.name,
      relativePath,
      parentPath: parentOf(relativePath),
      file,
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
      kind,
    })
  }

  items.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, 'es', { numeric: true }),
  )
  return { rootName, items }
}

function entriesInPath(
  files: LocalFileItem[],
  currentPath: string,
): BrowserEntry[] {
  const folders = new Map<string, number>()
  const uniqueFiles = new Map<string, LocalFileItem>()

  for (const item of files) {
    if (item.parentPath === currentPath) {
      uniqueFiles.set(item.id, item)
      continue
    }
    const prefix = currentPath ? `${currentPath}/` : ''
    if (currentPath && !item.relativePath.startsWith(prefix)) continue
    const rest = currentPath
      ? item.relativePath.slice(prefix.length)
      : item.relativePath
    const slash = rest.indexOf('/')
    if (slash === -1) continue
    const next = rest.slice(0, slash)
    const folderPath = currentPath ? `${currentPath}/${next}` : next
    folders.set(folderPath, (folders.get(folderPath) ?? 0) + 1)
  }

  const folderEntries: BrowserEntry[] = [...folders.entries()]
    .map(([path, childCount]) => ({
      type: 'folder' as const,
      folder: {
        path,
        name: path.split('/').pop() || path,
        childCount,
      },
    }))
    .sort((a, b) =>
      a.folder.name.localeCompare(b.folder.name, 'es', { numeric: true }),
    )

  const sortedFiles: BrowserEntry[] = [...uniqueFiles.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
    .map((file) => ({ type: 'file' as const, file }))

  return [...folderEntries, ...sortedFiles]
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list
  }
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function toPathAware(files: LocalFileItem[]) {
  return files.map((item) => ({
    id: item.id,
    name: item.name,
    file: item.file,
    kind: item.kind,
    previewUrl: item.previewUrl,
    parentPath: item.parentPath,
    relativePath: item.relativePath,
  }))
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

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8zm4 18H6V4h7v5h5z"
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

export function LocalFolderPdfPage() {
  const { areaId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getAreaUseCase } = useDependencies()

  const folderInputRef = useRef<HTMLInputElement>(null)
  const dragIndexRef = useRef<number | null>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [loadingArea, setLoadingArea] = useState(true)
  const [rootName, setRootName] = useState('')
  const [allFiles, setAllFiles] = useState<LocalFileItem[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [preparedDocs, setPreparedDocs] = useState<PreparedClientPdf[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [pdfName, setPdfName] = useState('')
  const [activePageId, setActivePageId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !areaId) return
    let cancelled = false
    setLoadingArea(true)
    void (async () => {
      try {
        const next = await getAreaUseCase.execute(user, areaId)
        if (cancelled) return
        if (!isAdminManagedFolderArea(next)) {
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
      for (const item of allFiles) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [allFiles])

  const browserEntries = useMemo(
    () => entriesInPath(allFiles, currentPath),
    [allFiles, currentPath],
  )

  const folderName = useMemo(() => {
    if (!currentPath) return ''
    return currentPath.split('/').pop() || currentPath
  }, [currentPath])

  const detectedClients = useMemo(() => {
    if (!rootName || allFiles.length === 0) return []
    return discoverClientJobs(toPathAware(allFiles), rootName)
  }, [allFiles, rootName])

  const currentClientJob = useMemo(() => {
    if (!rootName) return null
    if (!currentPath) return null
    return discoverClientJobAtPath(
      toPathAware(allFiles),
      currentPath,
      folderName,
    )
  }, [allFiles, currentPath, folderName, rootName])

  const breadcrumb = useMemo(() => {
    if (!rootName) return [] as Array<{ label: string; path: string }>
    const crumbs: Array<{ label: string; path: string }> = [
      { label: rootName, path: '' },
    ]
    if (!currentPath) return crumbs
    let acc = ''
    for (const part of currentPath.split('/')) {
      acc = acc ? `${acc}/${part}` : part
      crumbs.push({ label: part, path: acc })
    }
    return crumbs
  }, [rootName, currentPath])

  const activeDoc = useMemo(
    () =>
      preparedDocs.find((doc) => doc.id === activeDocId) ??
      preparedDocs[0] ??
      null,
    [preparedDocs, activeDocId],
  )

  const previewPages = activeDoc?.pages ?? []

  const activePage = useMemo(
    () => previewPages.find((page) => page.id === activePageId) ?? previewPages[0] ?? null,
    [previewPages, activePageId],
  )

  const previewFileName = useMemo(
    () => sanitizePdfFileName(pdfName || activeDoc?.fileName || 'cliente'),
    [pdfName, activeDoc?.fileName],
  )

  function clearPreview() {
    setPreparedDocs([])
    setActiveDocId(null)
    setActivePageId(null)
    setPdfName('')
  }

  function applyPrepared(docs: PreparedClientPdf[]) {
    setPreparedDocs(docs)
    const first = docs[0]
    setActiveDocId(first?.id ?? null)
    setPdfName(first?.label ?? '')
    setActivePageId(first?.pages[0]?.id ?? null)
  }

  function selectPreparedDoc(docId: string) {
    const doc = preparedDocs.find((item) => item.id === docId)
    if (!doc) return
    setActiveDocId(doc.id)
    setPdfName(doc.label)
    setActivePageId(doc.pages[0]?.id ?? null)
  }

  function updateActivePages(updater: (pages: ClientPdfPage[]) => ClientPdfPage[]) {
    if (!activeDoc) return
    setPreparedDocs((current) =>
      current.map((doc) =>
        doc.id === activeDoc.id
          ? { ...doc, pages: updater(doc.pages) }
          : doc,
      ),
    )
  }

  function clearLocalFolder() {
    for (const item of allFiles) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    setAllFiles([])
    setRootName('')
    setCurrentPath('')
    clearPreview()
    setStatus('')
  }

  function handlePickFolder(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const built = buildLocalFiles(Array.from(fileList))
    for (const item of allFiles) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    setRootName(built.rootName)
    setAllFiles(built.items)
    setCurrentPath('')
    clearPreview()
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  async function processJobs(
    jobs: ReturnType<typeof discoverClientJobs>,
    successMessage: string,
  ) {
    setBusy(true)
    setStatus('Preparando PDFs de clientes...')
    try {
      const docs = await prepareClientJobs(jobs, setStatus)
      applyPrepared(docs)
      swalSuccess(successMessage)
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudieron armar los PDF de los clientes',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function processAllClients() {
    const jobs = discoverClientJobs(toPathAware(allFiles), rootName)
    if (jobs.length === 0) {
      swalError('No hay carpetas de cliente con imágenes o PDF')
      return
    }
    await processJobs(
      jobs,
      `${jobs.length} cliente(s) listos. Revisa el preview y descarga.`,
    )
  }

  async function processCurrentClient() {
    if (!currentClientJob) {
      swalError('Esta carpeta no tiene imágenes ni PDF')
      return
    }
    await processJobs(
      [currentClientJob],
      `Cliente “${currentClientJob.clientName}” listo para previsualizar.`,
    )
  }

  function docsReadyForExport(): PreparedClientPdf[] {
    return preparedDocs.map((doc) =>
      doc.id === activeDoc?.id
        ? {
            ...doc,
            label: pdfName || doc.label,
            fileName: sanitizePdfFileName(pdfName || doc.fileName),
            pages: previewPages,
          }
        : doc,
    )
  }

  function outputFolderName(): string {
    return `${rootName || area?.name || 'clientes'}-PDFs`
  }

  async function downloadPreviewPdf() {
    if (!activeDoc || previewPages.length === 0) return
    setBusy(true)
    try {
      const result = await assembleClientPdf(
        previewPages,
        previewFileName,
        setStatus,
      )
      setPreparedDocs((current) =>
        current.map((doc) =>
          doc.id === activeDoc.id
            ? { ...doc, label: pdfName || doc.label, fileName: result.fileName }
            : doc,
        ),
      )
      downloadBlob(result.blob, result.fileName)
      swalSuccess('PDF del cliente descargado')
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo generar el PDF final',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function saveAllPdfsToFolder() {
    if (preparedDocs.length === 0) return
    setBusy(true)
    try {
      const docs = docsReadyForExport()
      const folderLabel = outputFolderName()

      if (canSavePdfsToFolder()) {
        try {
          const result = await savePreparedPdfsToFolder(
            docs,
            folderLabel,
            setStatus,
          )
          swalSuccess(
            `${result.count} PDF(s) guardados en la carpeta “${result.folderName}”`,
          )
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
        }
      }

      setStatus('Preparando ZIP con todos los PDFs...')
      const result = await zipPreparedPdfs(docs, folderLabel, setStatus)
      downloadBlob(result.blob, result.fileName)
      swalSuccess(
        `ZIP “${result.fileName}” con ${docs.length} PDF(s). Descomprímelo para obtener la carpeta.`,
      )
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudieron guardar los PDFs',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  function onDragStart(index: number) {
    dragIndexRef.current = index
  }

  function onDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    updateActivePages((pages) => moveItem(pages, from, index))
    dragIndexRef.current = index
  }

  function onDragEnd() {
    dragIndexRef.current = null
  }

  function movePage(index: number, direction: -1 | 1) {
    const target = index + direction
    updateActivePages((pages) => moveItem(pages, index, target))
  }

  if (loadingArea) {
    return (
      <section className="local-pdf-page">
        <p className="local-pdf-page__muted">Cargando actividad...</p>
      </section>
    )
  }

  if (!area) {
    return (
      <section className="local-pdf-page">
        <p className="local-pdf-page__muted">Actividad no encontrada.</p>
        <Link to="/areas" className="btn btn--soft-muted">
          Volver a actividades
        </Link>
      </section>
    )
  }

  const folderCount = browserEntries.filter((e) => e.type === 'folder').length
  const fileCount = browserEntries.filter((e) => e.type === 'file').length
  const atRoot = !currentPath

  return (
    <section className="local-pdf-page">
      <div className="local-pdf-page__top">
        <Link to="/areas" className="local-pdf-page__back">
          <IconBack />
          Actividades
        </Link>
      </div>

      <header className="local-pdf-hero">
        <div>
          <p className="local-pdf-page__eyebrow">Notificación / Deuda · admin</p>
          <h2>{area.name}</h2>
          <p>
            Selecciona la carpeta con los clientes. El sistema arma{' '}
            <strong>un PDF por cliente</strong> automáticamente; primero
            previsualizas y reordenas, luego descargas.
          </p>
        </div>
        <div className="local-pdf-hero__actions">
          <label className={`btn btn--soft-primary ${busy ? 'is-busy' : ''}`}>
            <IconFolder />
            {rootName ? 'Cambiar carpeta' : 'Seleccionar carpeta'}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              disabled={busy}
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
              onClick={clearLocalFolder}
            >
              Quitar carpeta
            </button>
          ) : null}
        </div>
      </header>

      {!rootName ? (
        <div className="local-pdf-empty panel">
          <IconFolder />
          <h3>Selecciona la carpeta de trabajo</h3>
          <p>
            Debe contener una carpeta por cliente (con imágenes y/o PDF
            escaneado). Luego pulsa “Procesar todos los clientes”.
          </p>
        </div>
      ) : (
        <>
          <div className="local-pdf-summary" aria-label="Resumen">
            <div className="local-pdf-summary__item">
              <strong>{rootName}</strong>
              <span>carpeta de trabajo</span>
            </div>
            <div className="local-pdf-summary__item">
              <strong>
                {atRoot ? detectedClients.length : folderName || '—'}
              </strong>
              <span>{atRoot ? 'clientes detectados' : 'carpeta actual'}</span>
            </div>
            <div className="local-pdf-summary__item">
              <strong>
                {folderCount}/{fileCount}
              </strong>
              <span>carpetas / archivos aquí</span>
            </div>
            <div className="local-pdf-summary__item">
              <strong>{preparedDocs.length}</strong>
              <span>PDF(s) en preview</span>
            </div>
          </div>

          <nav className="local-pdf-breadcrumbs" aria-label="Ruta">
            {currentPath ? (
              <button
                type="button"
                className="btn btn--soft-muted btn--small"
                disabled={busy}
                onClick={() => setCurrentPath(parentOf(currentPath))}
              >
                <IconBack />
                Subir
              </button>
            ) : null}
            <ol>
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.path || 'root'}>
                  {index > 0 ? <span>/</span> : null}
                  <button
                    type="button"
                    disabled={busy || crumb.path === currentPath}
                    onClick={() => setCurrentPath(crumb.path)}
                  >
                    {crumb.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="local-pdf-browser panel">
            <div className="local-pdf-browser__head">
              <strong>
                {atRoot
                  ? `Clientes en ${rootName}`
                  : `Cliente · ${folderName}`}
              </strong>
              <div className="local-pdf-browser__actions">
                {atRoot ? (
                  <button
                    type="button"
                    className="btn btn--soft-teal btn--small"
                    disabled={busy || detectedClients.length === 0}
                    onClick={() => void processAllClients()}
                  >
                    <IconPdf />
                    {busy && status
                      ? status
                      : `Procesar todos (${detectedClients.length})`}
                  </button>
                ) : currentClientJob ? (
                  <button
                    type="button"
                    className="btn btn--soft-teal btn--small"
                    disabled={busy}
                    onClick={() => void processCurrentClient()}
                  >
                    <IconPdf />
                    {busy && status
                      ? status
                      : 'Armar PDF de este cliente'}
                  </button>
                ) : (
                  <span>
                    {folderCount} carpeta{folderCount === 1 ? '' : 's'} ·{' '}
                    {fileCount} archivo{fileCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>

            <p className="local-pdf-hint">
              {atRoot
                ? `Se creará 1 PDF por cada carpeta de cliente (${detectedClients.length} detectado(s)). Luego podrás previsualizar y reordenar antes de descargar.`
                : currentClientJob
                  ? `Se unirán ${currentClientJob.files.filter((f) => f.kind === 'pdf').length} PDF y ${currentClientJob.files.filter((f) => f.kind === 'image').length} imagen(es) (incluye subcarpetas) en un solo documento.`
                  : 'Entra a una carpeta de cliente o vuelve a la raíz para procesar todos.'}
            </p>

            {browserEntries.length === 0 ? (
              <p className="local-pdf-page__muted">Esta carpeta está vacía.</p>
            ) : (
              <div className="local-pdf-browser__grid">
                {browserEntries.map((entry) => {
                  if (entry.type === 'folder') {
                    return (
                      <button
                        key={`dir-${entry.folder.path}`}
                        type="button"
                        className="local-pdf-entry local-pdf-entry--folder"
                        disabled={busy}
                        onClick={() => setCurrentPath(entry.folder.path)}
                      >
                        <span className="local-pdf-entry__icon">
                          <IconFolder />
                        </span>
                        <span className="local-pdf-entry__name">
                          {entry.folder.name}
                        </span>
                        <span className="local-pdf-entry__meta">
                          {atRoot ? 'Carpeta de cliente' : 'Subcarpeta'}
                        </span>
                      </button>
                    )
                  }

                  const item = entry.file
                  return (
                    <div
                      key={item.id}
                      className="local-pdf-entry local-pdf-entry--static"
                      title={item.relativePath}
                    >
                      {item.kind === 'image' && item.previewUrl ? (
                        <img
                          className="local-pdf-entry__thumb"
                          src={item.previewUrl}
                          alt={item.name}
                        />
                      ) : (
                        <span className="local-pdf-entry__icon">
                          {item.kind === 'pdf' ? <IconPdf /> : <IconFile />}
                        </span>
                      )}
                      <span className="local-pdf-entry__name">{item.name}</span>
                      <span className="local-pdf-entry__meta">
                        {item.kind === 'image'
                          ? 'Imagen'
                          : item.kind === 'pdf'
                            ? 'PDF escaneado'
                            : 'Archivo'}{' '}
                        · {formatBytes(item.file.size)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {preparedDocs.length > 0 && activeDoc ? (
            <section className="local-pdf-preview panel">
              <div className="local-pdf-preview__head">
                <div>
                  <h3>Previsualizador · {activeDoc.label}</h3>
                  <p>
                    Revisa cada cliente y, al terminar, guarda todos los PDFs en
                    una carpeta.
                  </p>
                </div>
                <div className="local-pdf-preview__actions">
                  <label className="field local-pdf-preview__name">
                    <span>Nombre del PDF</span>
                    <input
                      value={pdfName}
                      onChange={(event) => setPdfName(event.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn--soft-teal"
                    disabled={busy || preparedDocs.length === 0}
                    onClick={() => void saveAllPdfsToFolder()}
                  >
                    <IconFolder />
                    {busy && status
                      ? status
                      : `Guardar todos en carpeta (${preparedDocs.length})`}
                  </button>
                  <button
                    type="button"
                    className="btn btn--soft-primary"
                    disabled={busy || previewPages.length === 0}
                    onClick={() => void downloadPreviewPdf()}
                  >
                    <IconPdf />
                    Descargar solo este
                  </button>
                </div>
              </div>

              {preparedDocs.length > 1 ? (
                <div className="local-pdf-doc-tabs" role="tablist">
                  {preparedDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      role="tab"
                      aria-selected={doc.id === activeDoc.id}
                      className={`local-pdf-doc-tab${doc.id === activeDoc.id ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => selectPreparedDoc(doc.id)}
                    >
                      {doc.label}
                      <span>{doc.pages.length} pág.</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <p className="pdf-name-hint">
                Archivo: <strong>{previewFileName}</strong>
              </p>

              <div className="local-pdf-preview__stage">
                {activePage ? (
                  <img
                    className="local-pdf-preview__main"
                    src={activePage.thumbUrl}
                    alt={activePage.label}
                  />
                ) : (
                  <p className="local-pdf-page__muted">Sin páginas</p>
                )}
              </div>

              <div className="local-pdf-preview__strip" role="list">
                {previewPages.map((page, index) => (
                  <div
                    key={page.id}
                    role="listitem"
                    className={`local-pdf-page-card${activePage?.id === page.id ? ' is-active' : ''}`}
                    draggable={!busy}
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(event) => onDragOver(event, index)}
                    onDragEnd={onDragEnd}
                    onClick={() => setActivePageId(page.id)}
                  >
                    <span className="local-pdf-page-card__index">{index + 1}</span>
                    <img src={page.thumbUrl} alt={page.label} />
                    <span className="local-pdf-page-card__label" title={page.label}>
                      {page.label}
                    </span>
                    <div className="local-pdf-page-card__moves">
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        onClick={(event) => {
                          event.stopPropagation()
                          movePage(index, -1)
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === previewPages.length - 1}
                        onClick={(event) => {
                          event.stopPropagation()
                          movePage(index, 1)
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  )
}
