import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Area } from '@/domain/entities/Area'
import {
  officeDeviceSettingsToLocalConfig,
} from '@/domain/entities/OfficeDeviceSettings'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'
import {
  checkLocalDeviceBridge,
  requestLocalScan,
} from '@/infrastructure/devices/localDeviceBridgeClient'
import {
  loadLocalDeviceConfig,
  saveLocalDeviceConfig,
  type LocalDeviceConfig,
} from '@/infrastructure/devices/localDeviceConfig'
import {
  canSaveScanPdfsToFolder,
  classifyScanFile,
  flattenScanSources,
  pickOutputDirectory,
  saveSplitPdfsToDirectory,
  splitPagesIntoPdfs,
  zipSplitPdfs,
  type ScanSourceFile,
  type SplitPdfDoc,
} from '@/infrastructure/pdf/scanSplitPdfBuilder'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError, swalSuccess } from '@/presentation/utils/appSwal'
import './LocalFolderScanSplitPage.css'

const PAGES_PER_PDF_KEY = 'consorcio-scan-pages-per-pdf'
const BASE_NAME_KEY = 'consorcio-scan-base-name'

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

function readStoredPagesPerPdf(): number {
  const raw = Number(localStorage.getItem(PAGES_PER_PDF_KEY) || '3')
  if (!Number.isFinite(raw) || raw < 1) return 3
  return Math.min(50, Math.floor(raw))
}

export function LocalFolderScanSplitPage() {
  const { areaId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    getAreaUseCase,
    getOfficeDeviceSettingsUseCase,
    saveOfficeDeviceSettingsUseCase,
  } = useDependencies()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [loadingArea, setLoadingArea] = useState(true)
  const [sources, setSources] = useState<ScanSourceFile[]>([])
  const [pagesPerPdf, setPagesPerPdf] = useState(readStoredPagesPerPdf)
  const [baseName, setBaseName] = useState(
    () => localStorage.getItem(BASE_NAME_KEY) || 'Escaneo',
  )
  const [subfolderName, setSubfolderName] = useState('')
  const [outputDir, setOutputDir] = useState<FileSystemDirectoryHandle | null>(
    null,
  )
  const [docs, setDocs] = useState<SplitPdfDoc[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [deviceConfig, setDeviceConfig] = useState<LocalDeviceConfig>(() =>
    loadLocalDeviceConfig(),
  )
  const [cloudConfigLabel, setCloudConfigLabel] = useState(
    'Cargando config de oficina...',
  )
  const [bridgeStatus, setBridgeStatus] = useState<string>('Sin comprobar')
  const [scanPageCount, setScanPageCount] = useState(3)

  const canEditOfficeConfig = Boolean(user && assertUserCanManageUsers(user))

  const previewUrls = useMemo(() => {
    const map = new Map<string, string>()
    for (const doc of docs) {
      map.set(doc.id, URL.createObjectURL(doc.blob))
    }
    return map
  }, [docs])

  useEffect(() => {
    return () => {
      for (const url of previewUrls.values()) URL.revokeObjectURL(url)
    }
  }, [previewUrls])

  const activeDoc = useMemo(
    () => docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null,
    [docs, activeDocId],
  )

  const activePreviewUrl = activeDoc
    ? previewUrls.get(activeDoc.id) ?? null
    : null

  useEffect(() => {
    saveLocalDeviceConfig(deviceConfig)
  }, [deviceConfig])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const settings = await getOfficeDeviceSettingsUseCase.execute(user)
        if (cancelled) return
        const next = officeDeviceSettingsToLocalConfig(settings)
        setDeviceConfig(next)
        saveLocalDeviceConfig(next)
        if (settings.updatedAt && settings.updatedByName) {
          setCloudConfigLabel(
            `Oficina · ${settings.updatedByName} · ${settings.updatedAt.toLocaleString('es-PE')}`,
          )
        } else {
          setCloudConfigLabel('Oficina · valores por defecto (aún no guardados)')
        }
      } catch {
        if (!cancelled) {
          setCloudConfigLabel('Oficina · usando caché local (sin nube)')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, getOfficeDeviceSettingsUseCase])

  useEffect(() => {
    if (!user || !areaId) return
    let cancelled = false
    setLoadingArea(true)
    void (async () => {
      try {
        const next = await getAreaUseCase.execute(user, areaId)
        if (cancelled) return
        if (!next.scanSplitEnabled) {
          navigate('/areas', { replace: true })
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
    localStorage.setItem(PAGES_PER_PDF_KEY, String(pagesPerPdf))
  }, [pagesPerPdf])

  useEffect(() => {
    localStorage.setItem(BASE_NAME_KEY, baseName.trim() || 'Escaneo')
  }, [baseName])

  const estimatedGroups = useMemo(() => {
    if (pageCount <= 0) return 0
    return Math.ceil(pageCount / Math.max(1, pagesPerPdf))
  }, [pageCount, pagesPerPdf])

  function appendSourceFiles(files: File[]) {
    const next: ScanSourceFile[] = []
    for (const file of files) {
      const kind = classifyScanFile(file)
      if (!kind) continue
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        file,
        kind,
      })
    }
    if (next.length === 0) return
    setSources((current) =>
      [...current, ...next].sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { numeric: true }),
      ),
    )
    setDocs([])
    setActiveDocId(null)
    setPageCount(0)
  }

  function handlePickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const next: ScanSourceFile[] = []
    for (const file of Array.from(fileList)) {
      const kind = classifyScanFile(file)
      if (!kind) continue
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        file,
        kind,
      })
    }
    next.sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { numeric: true }),
    )
    setSources(next)
    setDocs([])
    setActiveDocId(null)
    setPageCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function testBridge() {
    setBusy(true)
    setStatus('Comprobando bridge...')
    try {
      const health = await checkLocalDeviceBridge(deviceConfig)
      setBridgeStatus(
        `OK · ${health.scanMode} · ${health.printerIp}:${health.printerPort}`,
      )
      swalSuccess(health.message || 'Bridge local conectado')
    } catch (error) {
      setBridgeStatus('Sin conexión')
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo conectar al bridge',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function saveOfficeConfigToCloud() {
    if (!user) return
    if (!canEditOfficeConfig) {
      swalError('Solo el administrador puede guardar la config de oficina')
      return
    }
    setBusy(true)
    setStatus('Guardando config de oficina...')
    try {
      const saved = await saveOfficeDeviceSettingsUseCase.execute(user, {
        bridgeBaseUrl: deviceConfig.bridgeBaseUrl,
        printerIp: deviceConfig.printerIp,
        printerPort: deviceConfig.printerPort,
        twainDriverName: deviceConfig.twainDriverName,
        scanDriver: deviceConfig.scanDriver,
        scanSource: deviceConfig.scanSource,
      })
      const next = officeDeviceSettingsToLocalConfig(saved)
      setDeviceConfig(next)
      saveLocalDeviceConfig(next)
      setCloudConfigLabel(
        `Oficina · ${saved.updatedByName || user.displayName} · ${(saved.updatedAt ?? new Date()).toLocaleString('es-PE')}`,
      )
      swalSuccess('Config de oficina guardada en la nube. Todos la verán.')
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo guardar la config de oficina',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function scanFromCanon() {
    setBusy(true)
    setStatus('Escaneando con Canon...')
    try {
      const files = await requestLocalScan({
        config: deviceConfig,
        pageCount: scanPageCount,
      })
      appendSourceFiles(files)
      swalSuccess(`${files.length} página(s) recibidas del escáner`)
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo escanear',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function chooseOutputFolder() {
    try {
      const handle = await pickOutputDirectory()
      setOutputDir(handle)
      swalSuccess(`Carpeta de guardado: ${handle.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudo elegir la carpeta',
      )
    }
  }

  function renameDoc(docId: string, nextName: string) {
    setDocs((current) =>
      current.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              label: nextName.replace(/\.pdf$/i, '').trim() || doc.label,
              fileName: sanitizePdfFileName(nextName),
            }
          : doc,
      ),
    )
  }

  async function processSplit() {
    if (sources.length === 0) {
      swalError('Selecciona imágenes o PDFs escaneados')
      return
    }
    setBusy(true)
    setStatus('Leyendo páginas...')
    try {
      const pages = await flattenScanSources(sources, setStatus)
      setPageCount(pages.length)
      const split = await splitPagesIntoPdfs(
        pages,
        pagesPerPdf,
        baseName.trim() || 'Escaneo',
        setStatus,
      )
      setDocs(split)
      setActiveDocId(split[0]?.id ?? null)
      swalSuccess(
        `${split.length} PDF(s) listos. Previsualiza, renombra y luego guarda.`,
      )
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudieron separar los escaneos',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function savePreparedDocs() {
    if (docs.length === 0) {
      swalError('Primero separa los escaneos para generar los PDF')
      return
    }
    setBusy(true)
    try {
      if (canSaveScanPdfsToFolder()) {
        // Siempre pedir carpeta: el usuario elige cualquier ruta del PC.
        let directory: FileSystemDirectoryHandle
        try {
          directory = await pickOutputDirectory()
          setOutputDir(directory)
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
          throw error
        }
        const saved = await saveSplitPdfsToDirectory(
          docs,
          directory,
          subfolderName.trim() || null,
          setStatus,
        )
        const where = subfolderName.trim()
          ? `${directory.name}/${saved.folderName}`
          : directory.name
        swalSuccess(
          `${saved.count} PDF(s) guardados en “${where}”`,
        )
        return
      }

      const zip = await zipSplitPdfs(
        docs,
        subfolderName.trim() || `${area?.name || 'escaneos'}-pdf`,
      )
      downloadBlob(zip.blob, zip.fileName)
      swalSuccess(
        `ZIP con ${docs.length} PDF(s) descargado. Usa Chrome/Edge para guardar directo en cualquier carpeta.`,
      )
    } catch (error) {
      swalError(
        error instanceof DomainError
          ? error.message
          : 'No se pudieron guardar los PDF',
      )
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  if (loadingArea) {
    return (
      <section className="scan-split-page">
        <p className="scan-split-page__muted">Cargando actividad...</p>
      </section>
    )
  }

  if (!area) {
    return (
      <section className="scan-split-page">
        <p className="scan-split-page__muted">Actividad no encontrada.</p>
        <Link to="/areas" className="btn btn--soft-muted">
          Volver a actividades
        </Link>
      </section>
    )
  }

  return (
    <section className="scan-split-page">
      <div className="scan-split-page__top">
        <Link to="/areas" className="scan-split-page__back">
          <IconBack />
          Actividades
        </Link>
      </div>

      <header className="scan-split-hero">
        <div>
          <p className="scan-split-page__eyebrow">Escanear y separar · local</p>
          <h2>{area.name}</h2>
          <p>
            Escanea con la Canon (bridge local) o carga archivos. Separa en PDFs
            de <strong>{pagesPerPdf} página(s)</strong> y al guardar eliges{' '}
            <strong>cualquier carpeta</strong> del PC (sin Firebase).
          </p>
        </div>
        <div className="scan-split-hero__actions">
          <button
            type="button"
            className="btn btn--soft-teal"
            disabled={busy}
            onClick={() => void scanFromCanon()}
          >
            {busy && status.includes('Escaneando')
              ? status
              : 'Escanear con Canon'}
          </button>
          <label className={`btn btn--soft-primary ${busy ? 'is-busy' : ''}`}>
            <IconFolder />
            {sources.length ? 'Agregar / cambiar archivos' : 'Seleccionar archivos'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              disabled={busy}
              accept="image/*,.pdf,application/pdf"
              onChange={(event) => handlePickFiles(event.target.files)}
            />
          </label>
          <button
            type="button"
            className="btn btn--soft-muted"
            disabled={busy}
            onClick={() => void chooseOutputFolder()}
            title="Opcional: preselecciona la carpeta. Al guardar también podrás elegirla."
          >
            <IconFolder />
            {outputDir
              ? `Carpeta: ${outputDir.name}`
              : 'Elegir carpeta (cualquier ruta)'}
          </button>
        </div>
      </header>

      <div className="scan-split-device panel">
        <div className="scan-split-device__head">
          <strong>Equipo de oficina (Canon · nube)</strong>
          <span>{bridgeStatus}</span>
        </div>
        <p className="scan-split-device__cloud">{cloudConfigLabel}</p>
        <div className="scan-split-config scan-split-config--device">
          <label className="field">
            <span>URL bridge (este PC)</span>
            <input
              value={deviceConfig.bridgeBaseUrl}
              disabled={busy || !canEditOfficeConfig}
              onChange={(event) =>
                setDeviceConfig((current) => ({
                  ...current,
                  bridgeBaseUrl: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>IP impresora/escáner</span>
            <input
              value={deviceConfig.printerIp}
              disabled={busy || !canEditOfficeConfig}
              onChange={(event) =>
                setDeviceConfig((current) => ({
                  ...current,
                  printerIp: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Puerto RAW</span>
            <input
              type="number"
              value={deviceConfig.printerPort}
              disabled={busy || !canEditOfficeConfig}
              onChange={(event) =>
                setDeviceConfig((current) => ({
                  ...current,
                  printerPort: Number(event.target.value) || 9100,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Escáner (como Windows)</span>
            <input
              value={deviceConfig.twainDriverName}
              disabled={busy || !canEditOfficeConfig}
              onChange={(event) =>
                setDeviceConfig((current) => ({
                  ...current,
                  twainDriverName: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Modo (WIA = app Escáner)</span>
            <select
              value={deviceConfig.scanDriver}
              disabled={busy || !canEditOfficeConfig}
              onChange={(event) =>
                setDeviceConfig((current) => ({
                  ...current,
                  scanDriver: event.target.value === 'twain' ? 'twain' : 'wia',
                }))
              }
            >
              <option value="wia">WIA (Windows Escáner)</option>
              <option value="twain">TWAIN (ScanGear)</option>
            </select>
          </label>
          <label className="field">
            <span>Origen del papel</span>
            <select
              value={deviceConfig.scanSource}
              disabled={busy || !canEditOfficeConfig}
              onChange={(event) => {
                const value = event.target.value
                setDeviceConfig((current) => ({
                  ...current,
                  scanSource:
                    value === 'glass' || value === 'duplex' ? value : 'feeder',
                }))
              }}
            >
              <option value="feeder">Alimentador</option>
              <option value="glass">Plano</option>
              <option value="duplex">Dúplex</option>
            </select>
          </label>
          <label className="field">
            <span>Hojas a escanear ahora</span>
            <input
              type="number"
              min={1}
              max={30}
              value={scanPageCount}
              disabled={busy}
              onChange={(event) =>
                setScanPageCount(
                  Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                )
              }
            />
          </label>
          <div className="scan-split-device__actions">
            <button
              type="button"
              className="btn btn--soft-muted btn--small"
              disabled={busy}
              onClick={() => void testBridge()}
            >
              Probar bridge
            </button>
            {canEditOfficeConfig ? (
              <button
                type="button"
                className="btn btn--soft-primary btn--small"
                disabled={busy}
                onClick={() => void saveOfficeConfigToCloud()}
              >
                Guardar config de oficina
              </button>
            ) : null}
          </div>
        </div>
        <p className="scan-split-hint">
          La IP de la Canon y el driver se comparten en la nube. El bridge debe
          estar abierto en <strong>este PC</strong> (
          <code>http://localhost:5000</code> ·{' '}
          <code>Iniciar-Bridge-Consorcio.cmd</code>). En Chrome, permite el
          acceso a red local cuando Vercel lo pida. Luego: hojas en el ADF →
          Escanear con Canon.
        </p>
      </div>

      <div className="scan-split-config panel">
        <label className="field">
          <span>Páginas por PDF</span>
          <input
            type="number"
            min={1}
            max={50}
            value={pagesPerPdf}
            disabled={busy}
            onChange={(event) =>
              setPagesPerPdf(
                Math.min(50, Math.max(1, Number(event.target.value) || 1)),
              )
            }
          />
        </label>
        <label className="field">
          <span>Nombre base de los PDF</span>
          <input
            value={baseName}
            disabled={busy}
            onChange={(event) => setBaseName(event.target.value)}
            placeholder="Escaneo"
          />
        </label>
        <label className="field">
          <span>Subcarpeta (opcional)</span>
          <input
            value={subfolderName}
            disabled={busy}
            onChange={(event) => setSubfolderName(event.target.value)}
            placeholder="Vacío = guardar directo en la carpeta elegida"
          />
        </label>
      </div>

      <div className="scan-split-summary" aria-label="Resumen">
        <div className="scan-split-summary__item">
          <strong>{sources.length}</strong>
          <span>archivos cargados</span>
        </div>
        <div className="scan-split-summary__item">
          <strong>{pageCount || '—'}</strong>
          <span>páginas detectadas</span>
        </div>
        <div className="scan-split-summary__item">
          <strong>{estimatedGroups || '—'}</strong>
          <span>PDFs estimados</span>
        </div>
        <div className="scan-split-summary__item">
          <strong>{docs.length || '—'}</strong>
          <span>PDFs generados</span>
        </div>
      </div>

      <div className="scan-split-browser panel">
        <div className="scan-split-browser__head">
          <strong>
            {sources.length
              ? 'Archivos a procesar'
              : 'Sin archivos todavía'}
          </strong>
          <div className="scan-split-browser__actions">
            <button
              type="button"
              className="btn btn--soft-teal"
              disabled={busy || sources.length === 0}
              onClick={() => void processSplit()}
            >
              <IconPdf />
              {busy && status
                ? status
                : `Separar (cada ${pagesPerPdf})`}
            </button>
            <button
              type="button"
              className="btn btn--soft-primary"
              disabled={busy || docs.length === 0}
              onClick={() => void savePreparedDocs()}
              title="Abre el selector para guardar en cualquier carpeta del PC"
            >
              <IconFolder />
              {busy && status.startsWith('Guardando')
                ? status
                : `Guardar en carpeta (${docs.length})`}
            </button>
          </div>
        </div>

        {sources.length === 0 ? (
          <p className="scan-split-hint">
            Escanea con Canon o selecciona archivos. Luego separa, previsualiza,
            renombra y guarda.
          </p>
        ) : (
          <ul className="scan-split-file-list">
            {sources.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <em>{item.kind === 'pdf' ? 'PDF' : 'Imagen'}</em>
              </li>
            ))}
          </ul>
        )}
      </div>

      {docs.length > 0 && activeDoc ? (
        <section className="scan-split-preview panel">
          <div className="scan-split-preview__head">
            <div>
              <h3>Previsualizador · {activeDoc.fileName}</h3>
              <p>
                Elige cada PDF, cambia el nombre y pulsa Guardar: eliges
                cualquier carpeta del PC.
              </p>
            </div>
            <label className="field scan-split-preview__name">
              <span>Nombre de este PDF</span>
              <input
                value={activeDoc.fileName.replace(/\.pdf$/i, '')}
                disabled={busy}
                onChange={(event) =>
                  renameDoc(activeDoc.id, event.target.value)
                }
              />
            </label>
          </div>

          <div className="scan-split-doc-tabs" role="tablist">
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                role="tab"
                aria-selected={doc.id === activeDoc.id}
                className={`scan-split-doc-tab${doc.id === activeDoc.id ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => setActiveDocId(doc.id)}
              >
                {doc.fileName}
                <span>{doc.pageCount} pág.</span>
              </button>
            ))}
          </div>

          <div className="scan-split-preview__stage">
            {activePreviewUrl ? (
              <iframe
                title={`Vista previa ${activeDoc.fileName}`}
                src={activePreviewUrl}
                className="scan-split-preview__frame"
              />
            ) : (
              <p className="scan-split-page__muted">Sin vista previa</p>
            )}
          </div>
        </section>
      ) : null}
    </section>
  )
}
