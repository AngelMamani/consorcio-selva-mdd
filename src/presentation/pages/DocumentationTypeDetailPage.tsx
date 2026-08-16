import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type { DocumentationType } from '@/domain/entities/DocumentationType'
import type {
  DocumentationCellValue,
  DocumentationImageValue,
  DocumentationRow,
} from '@/domain/entities/DocumentationRow'
import {
  DocumentationColumnType,
  documentationColumnTypeLabel,
} from '@/domain/value-objects/DocumentationColumnType'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import { StorageImage } from '@/presentation/components/StorageImage'
import './DocumentationPage.css'

type DraftColumn = {
  id: string
  name: string
  type: DocumentationColumnType
}

function isImageValue(
  value: DocumentationCellValue,
): value is DocumentationImageValue {
  return Boolean(value && typeof value === 'object' && 'storagePath' in value)
}

function emptyValues(
  columns: DocumentationColumn[],
): Record<string, DocumentationCellValue> {
  const values: Record<string, DocumentationCellValue> = {}
  for (const column of columns) {
    values[column.id] =
      column.type === DocumentationColumnType.Numero ? null : ''
  }
  return values
}

export function DocumentationTypeDetailPage() {
  const { typeId = '' } = useParams()
  const { user } = useAuth()
  const {
    getDocumentationTypeUseCase,
    saveDocumentationColumnsUseCase,
    listDocumentationRowsUseCase,
    createDocumentationRowUseCase,
    updateDocumentationRowUseCase,
    deleteDocumentationRowUseCase,
    importDocumentationFromExcelUseCase,
    downloadDocumentationExcelTemplateUseCase,
    exportDocumentationToWordUseCase,
    uploadDocumentationCellImageUseCase,
  } = useDependencies()

  const [docType, setDocType] = useState<DocumentationType | null>(null)
  const [rows, setRows] = useState<DocumentationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [columnDrafts, setColumnDrafts] = useState<DraftColumn[]>([])
  const [columnsModalOpen, setColumnsModalOpen] = useState(false)
  const [rowModalOpen, setRowModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<DocumentationRow | null>(null)
  const [rowValues, setRowValues] = useState<
    Record<string, DocumentationCellValue>
  >({})
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null)

  const excelInputRef = useRef<HTMLInputElement>(null)
  const columns = docType?.columns ?? []

  const importableColumns = useMemo(
    () =>
      columns.filter(
        (column) => column.type !== DocumentationColumnType.Imagen,
      ),
    [columns],
  )

  const step = columns.length === 0 ? 2 : 3

  async function loadAll() {
    if (!user || !typeId) return
    setLoading(true)
    setError(null)
    try {
      const [nextType, nextRows] = await Promise.all([
        getDocumentationTypeUseCase.execute(user, typeId),
        listDocumentationRowsUseCase.execute(user, typeId),
      ])
      setDocType(nextType)
      setRows(nextRows)
    } catch (err) {
      setDocType(null)
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo cargar la documentación',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, typeId])

  function openColumnsModal() {
    setColumnDrafts(
      columns.map((column) => ({
        id: column.id,
        name: column.name,
        type: column.type,
      })),
    )
    setColumnsModalOpen(true)
    setError(null)
  }

  function addColumnDraft() {
    setColumnDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: '',
        type: DocumentationColumnType.Texto,
      },
    ])
  }

  function updateColumnDraft(
    id: string,
    patch: Partial<Pick<DraftColumn, 'name' | 'type'>>,
  ) {
    setColumnDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function removeColumnDraft(id: string) {
    setColumnDrafts((current) => current.filter((item) => item.id !== id))
  }

  async function handleSaveColumns(event: FormEvent) {
    event.preventDefault()
    if (!user || !typeId || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const saved = await saveDocumentationColumnsUseCase.execute(
        user,
        typeId,
        columnDrafts.map((item, index) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          order: index,
        })),
      )
      setDocType(saved)
      setColumnsModalOpen(false)
      setSuccess('Columnas actualizadas')
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudieron guardar las columnas',
      )
    } finally {
      setBusy(false)
    }
  }

  function openCreateRow() {
    setEditingRow(null)
    setRowValues(emptyValues(columns))
    setRowModalOpen(true)
    setError(null)
  }

  function openEditRow(row: DocumentationRow) {
    const values = emptyValues(columns)
    for (const column of columns) {
      values[column.id] = row.values[column.id] ?? values[column.id]
    }
    setEditingRow(row)
    setRowValues(values)
    setRowModalOpen(true)
    setError(null)
  }

  async function handleSaveRow(event: FormEvent) {
    event.preventDefault()
    if (!user || !typeId || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (editingRow) {
        const updated = await updateDocumentationRowUseCase.execute(
          user,
          typeId,
          editingRow.id,
          rowValues,
        )
        setRows((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        setSuccess('Registro actualizado')
      } else {
        const created = await createDocumentationRowUseCase.execute(
          user,
          typeId,
          rowValues,
        )
        setRows((current) => [created, ...current])
        setSuccess('Registro creado')
      }
      setRowModalOpen(false)
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo guardar el registro',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteRow() {
    if (!user || !typeId || !deleteRowId || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteDocumentationRowUseCase.execute(user, typeId, deleteRowId)
      setRows((current) => current.filter((item) => item.id !== deleteRowId))
      setDeleteRowId(null)
      setSuccess('Registro eliminado')
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo eliminar el registro',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadTemplate() {
    if (!user || !typeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await downloadDocumentationExcelTemplateUseCase.execute(
        user,
        typeId,
      )
      const safe = (docType?.name || 'documentacion')
        .toLowerCase()
        .replace(/\s+/g, '-')
      saveAs(blob, `plantilla-${safe}.xlsx`)
      setSuccess('Plantilla Excel descargada')
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo descargar la plantilla',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleImportExcel(file: File) {
    if (!user || !typeId || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const buffer = await file.arrayBuffer()
      const created = await importDocumentationFromExcelUseCase.execute(
        user,
        typeId,
        buffer,
      )
      setRows((current) => [...created, ...current])
      setImportModalOpen(false)
      setSuccess(`Se importaron ${created.length} fila(s) desde Excel`)
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo importar el Excel',
      )
    } finally {
      setBusy(false)
      if (excelInputRef.current) excelInputRef.current.value = ''
    }
  }

  async function handleExportWord() {
    if (!user || !typeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await exportDocumentationToWordUseCase.execute(user, typeId)
      const safe = (docType?.name || 'documentacion')
        .toLowerCase()
        .replace(/\s+/g, '-')
      saveAs(blob, `${safe}.docx`)
      setSuccess('Documento Word exportado')
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo exportar a Word',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleUploadImage(
    rowId: string,
    columnId: string,
    file: File,
  ) {
    if (!user || !typeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const uploaded = await uploadDocumentationCellImageUseCase.execute(
        user,
        typeId,
        rowId,
        columnId,
        {
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          sizeBytes: file.size,
          data: file,
        },
      )
      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? {
                ...row,
                values: { ...row.values, [columnId]: uploaded },
                updatedAt: new Date(),
              }
            : row,
        ),
      )
      if (editingRow?.id === rowId) {
        setRowValues((current) => ({ ...current, [columnId]: uploaded }))
      }
      setSuccess('Imagen cargada')
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo subir la imagen',
      )
    } finally {
      setBusy(false)
    }
  }

  function renderCellValue(
    column: DocumentationColumn,
    value: DocumentationCellValue,
  ) {
    if (column.type === DocumentationColumnType.Imagen) {
      if (!isImageValue(value)) {
        return <span className="docs-muted">Sin imagen</span>
      }
      return (
        <StorageImage
          storagePath={value.storagePath}
          alt={value.fileName}
          className="docs-thumb"
          openOnClick
        />
      )
    }
    if (value === null || value === undefined || value === '') {
      return <span className="docs-muted">—</span>
    }
    return String(value)
  }

  if (!user) return null

  return (
    <section className="docs-page">
      <div className="page-header">
        <div>
          <p className="docs-page__eyebrow">
            <Link to="/documentacion" className="docs-back">
              ← Tipos
            </Link>
          </p>
          <h1>{docType?.name || 'Documentación'}</h1>
          <p>
            {docType?.description?.trim()
              ? docType.description
              : 'Define columnas y luego introduce los registros de este tipo.'}
          </p>
        </div>
      </div>

      <ol className="docs-steps" aria-label="Orden de trabajo">
        <li className="docs-steps__item docs-steps__item--done">
          <strong>1</strong>
          <span>Tipo creado</span>
        </li>
        <li
          className={`docs-steps__item ${step === 2 ? 'docs-steps__item--current' : 'docs-steps__item--done'}`}
        >
          <strong>2</strong>
          <span>Definir columnas</span>
        </li>
        <li
          className={`docs-steps__item ${step === 3 ? 'docs-steps__item--current' : ''}`}
        >
          <strong>3</strong>
          <span>Registrar datos</span>
        </li>
      </ol>

      <div className="docs-toolbar">
        <button
          type="button"
          className="btn btn--soft-muted"
          onClick={openColumnsModal}
          disabled={busy || !docType}
        >
          {columns.length === 0 ? 'Crear columnas' : 'Editar columnas'}
        </button>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={openCreateRow}
          disabled={busy || columns.length === 0}
        >
          Nuevo registro
        </button>
        <button
          type="button"
          className="btn btn--soft-muted"
          onClick={() => setImportModalOpen(true)}
          disabled={busy || importableColumns.length === 0}
        >
          Importar Excel
        </button>
        <button
          type="button"
          className="btn btn--soft-muted"
          onClick={() => void handleExportWord()}
          disabled={busy || columns.length === 0}
        >
          Exportar Word
        </button>
      </div>

      {error ? <p className="form-alert form-alert--error">{error}</p> : null}
      {success ? (
        <p className="form-alert form-alert--success">{success}</p>
      ) : null}

      {loading ? (
        <p className="docs-muted">Cargando…</p>
      ) : !docType ? (
        <div className="docs-empty">
          <h2>Tipo no encontrado</h2>
          <Link to="/documentacion" className="btn btn--soft-primary">
            Volver a tipos
          </Link>
        </div>
      ) : columns.length === 0 ? (
        <div className="docs-empty">
          <h2>Paso 2 · Define las columnas</h2>
          <p>
            Antes de registrar datos, crea las columnas de{' '}
            <strong>{docType.name}</strong> (texto, número o imagen).
          </p>
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={openColumnsModal}
          >
            Crear columnas
          </button>
        </div>
      ) : (
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.id}>
                    <span>{column.name}</span>
                    <small>{documentationColumnTypeLabel(column.type)}</small>
                  </th>
                ))}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1}>
                    <span className="docs-muted">
                      Paso 3 · Aún no hay registros. Agrega uno o importa Excel.
                    </span>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={`${row.id}-${column.id}`}>
                        {renderCellValue(column, row.values[column.id] ?? null)}
                      </td>
                    ))}
                    <td>
                      <div className="docs-row-actions">
                        <button
                          type="button"
                          className="btn btn--soft-muted btn--small"
                          onClick={() => openEditRow(row)}
                          disabled={busy}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn--soft-rose btn--small"
                          onClick={() => setDeleteRowId(row.id)}
                          disabled={busy}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <AppModal
        open={columnsModalOpen}
        title={`Columnas · ${docType?.name ?? ''}`}
        description="Nombre y tipo de cada columna de este tipo."
        onClose={() => setColumnsModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setColumnsModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="docs-columns-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              Guardar columnas
            </button>
          </>
        }
      >
        <form
          id="docs-columns-form"
          onSubmit={(e) => void handleSaveColumns(e)}
        >
          <div className="docs-columns-list">
            {columnDrafts.length === 0 ? (
              <p className="docs-muted">Agrega al menos una columna.</p>
            ) : (
              columnDrafts.map((draft, index) => (
                <div key={draft.id} className="docs-column-row">
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        updateColumnDraft(draft.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder={`Columna ${index + 1}`}
                      required
                      maxLength={80}
                    />
                  </label>
                  <label className="field">
                    <span>Tipo</span>
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        updateColumnDraft(draft.id, {
                          type: event.target.value as DocumentationColumnType,
                        })
                      }
                    >
                      <option value={DocumentationColumnType.Texto}>
                        Texto
                      </option>
                      <option value={DocumentationColumnType.Numero}>
                        Número
                      </option>
                      <option value={DocumentationColumnType.Imagen}>
                        Imagen
                      </option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn--soft-rose btn--small"
                    onClick={() => removeColumnDraft(draft.id)}
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            className="btn btn--soft-muted"
            onClick={addColumnDraft}
          >
            Agregar columna
          </button>
        </form>
      </AppModal>

      <AppModal
        open={rowModalOpen}
        title={editingRow ? 'Editar registro' : 'Nuevo registro'}
        onClose={() => setRowModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setRowModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="docs-row-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              Guardar
            </button>
          </>
        }
      >
        <form id="docs-row-form" onSubmit={(e) => void handleSaveRow(e)}>
          <div className="docs-row-form">
            {columns.map((column) => {
              const value = rowValues[column.id]
              if (column.type === DocumentationColumnType.Imagen) {
                return (
                  <div key={column.id} className="field">
                    <span>{column.name}</span>
                    {isImageValue(value) ? (
                      <StorageImage
                        storagePath={value.storagePath}
                        alt={value.fileName}
                        className="docs-thumb docs-thumb--form"
                        openOnClick
                      />
                    ) : (
                      <p className="docs-muted">
                        {editingRow
                          ? 'Sin imagen. Sube un archivo.'
                          : 'Guarda el registro y luego sube la imagen al editar.'}
                      </p>
                    )}
                    {editingRow ? (
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            void handleUploadImage(
                              editingRow.id,
                              column.id,
                              file,
                            )
                          }
                        }}
                      />
                    ) : null}
                  </div>
                )
              }

              if (column.type === DocumentationColumnType.Numero) {
                return (
                  <label key={column.id} className="field">
                    <span>{column.name}</span>
                    <input
                      type="number"
                      step="any"
                      value={
                        value === null || value === undefined
                          ? ''
                          : String(value)
                      }
                      onChange={(event) =>
                        setRowValues((current) => ({
                          ...current,
                          [column.id]:
                            event.target.value === ''
                              ? null
                              : Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                )
              }

              return (
                <label key={column.id} className="field">
                  <span>{column.name}</span>
                  <input
                    type="text"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) =>
                      setRowValues((current) => ({
                        ...current,
                        [column.id]: event.target.value,
                      }))
                    }
                    maxLength={2000}
                  />
                </label>
              )
            })}
          </div>
        </form>
      </AppModal>

      <AppModal
        open={importModalOpen}
        title="Importar Excel"
        description={`Plantilla para «${docType?.name ?? ''}».`}
        onClose={() => setImportModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => void handleDownloadTemplate()}
              disabled={busy}
            >
              Descargar plantilla
            </button>
            <button
              type="button"
              className="btn btn--soft-primary"
              onClick={() => excelInputRef.current?.click()}
              disabled={busy}
            >
              Elegir archivo
            </button>
          </>
        }
      >
        <div className="docs-import-help">
          <p>
            El archivo debe ser <strong>.xlsx</strong>. La primera fila son los
            encabezados y deben coincidir con tus columnas de texto/número:
          </p>
          <div className="docs-table-wrap docs-table-wrap--sample">
            <table className="docs-table docs-table--sample">
              <thead>
                <tr>
                  {importableColumns.map((column) => (
                    <th key={column.id}>{column.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {importableColumns.map((column) => (
                    <td key={column.id}>
                      {column.type === DocumentationColumnType.Numero
                        ? '10'
                        : `Ejemplo ${column.name}`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="docs-muted">
            Las columnas de imagen no se importan por Excel; súbelas al editar.
          </p>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImportExcel(file)
            }}
          />
        </div>
      </AppModal>

      <AppModal
        open={Boolean(deleteRowId)}
        title="Eliminar registro"
        description="Esta acción no se puede deshacer."
        danger
        onClose={() => setDeleteRowId(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setDeleteRowId(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--soft-rose"
              onClick={() => void handleDeleteRow()}
              disabled={busy}
            >
              Eliminar
            </button>
          </>
        }
      >
        <p>¿Seguro que quieres eliminar este registro?</p>
      </AppModal>
    </section>
  )
}
