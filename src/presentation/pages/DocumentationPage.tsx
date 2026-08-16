import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentationType } from '@/domain/entities/DocumentationType'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import './DocumentationPage.css'

export function DocumentationPage() {
  const { user } = useAuth()
  const {
    listDocumentationTypesUseCase,
    createDocumentationTypeUseCase,
    updateDocumentationTypeUseCase,
    deleteDocumentationTypeUseCase,
  } = useDependencies()

  const [types, setTypes] = useState<DocumentationType[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentationType | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function loadTypes() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const next = await listDocumentationTypesUseCase.execute(user)
      setTypes(next)
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudieron cargar los tipos',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setModalOpen(true)
    setError(null)
  }

  function openEdit(type: DocumentationType) {
    setEditing(type)
    setName(type.name)
    setDescription(type.description)
    setModalOpen(true)
    setError(null)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (editing) {
        const updated = await updateDocumentationTypeUseCase.execute(
          user,
          editing.id,
          { name, description },
        )
        setTypes((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        setSuccess('Tipo actualizado')
      } else {
        const created = await createDocumentationTypeUseCase.execute(user, {
          name,
          description,
        })
        setTypes((current) => [created, ...current])
        setSuccess('Tipo de documentación creado')
      }
      setModalOpen(false)
    } catch (err) {
      setError(
        err instanceof DomainError ? err.message : 'No se pudo guardar el tipo',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!user || !deleteId || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteDocumentationTypeUseCase.execute(user, deleteId)
      setTypes((current) => current.filter((item) => item.id !== deleteId))
      setDeleteId(null)
      setSuccess('Tipo eliminado')
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo eliminar el tipo',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <section className="docs-page">
      <div className="page-header">
        <div>
          <p className="docs-page__eyebrow">Paso 1 · Tipos</p>
          <h1>Documentación</h1>
          <p>
            Primero crea el tipo de documentación (ej. Estado de medidores).
            Luego define columnas y carga registros.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--soft-primary"
          onClick={openCreate}
          disabled={busy}
        >
          Nuevo tipo
        </button>
      </div>

      <ol className="docs-steps" aria-label="Orden de trabajo">
        <li className="docs-steps__item docs-steps__item--current">
          <strong>1</strong>
          <span>Crear tipo</span>
        </li>
        <li className="docs-steps__item">
          <strong>2</strong>
          <span>Definir columnas</span>
        </li>
        <li className="docs-steps__item">
          <strong>3</strong>
          <span>Registrar datos</span>
        </li>
      </ol>

      {error ? <p className="form-alert form-alert--error">{error}</p> : null}
      {success ? (
        <p className="form-alert form-alert--success">{success}</p>
      ) : null}

      {loading ? (
        <p className="docs-muted">Cargando tipos…</p>
      ) : types.length === 0 ? (
        <div className="docs-empty">
          <h2>Sin tipos de documentación</h2>
          <p>
            Empieza creando uno, por ejemplo: <em>Estado de medidores</em>,{' '}
            <em>Inspecciones</em> o <em>Inventario</em>.
          </p>
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={openCreate}
          >
            Crear primer tipo
          </button>
        </div>
      ) : (
        <div className="docs-type-grid">
          {types.map((type) => (
            <article key={type.id} className="docs-type-card">
              <div className="docs-type-card__body">
                <p className="docs-type-card__meta">
                  {type.columns.length} columna
                  {type.columns.length === 1 ? '' : 's'}
                </p>
                <h2>{type.name}</h2>
                <p>
                  {type.description.trim()
                    ? type.description
                    : 'Sin descripción'}
                </p>
              </div>
              <div className="docs-type-card__actions">
                <Link
                  to={`/documentacion/${type.id}`}
                  className="btn btn--soft-primary btn--small"
                >
                  Abrir
                </Link>
                <button
                  type="button"
                  className="btn btn--soft-muted btn--small"
                  onClick={() => openEdit(type)}
                  disabled={busy}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--soft-rose btn--small"
                  onClick={() => setDeleteId(type.id)}
                  disabled={busy}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? 'Editar tipo' : 'Nuevo tipo de documentación'}
        description="Define a qué corresponde esta documentación."
        onClose={() => setModalOpen(false)}
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
              form="docs-type-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              Guardar
            </button>
          </>
        }
      >
        <form id="docs-type-form" onSubmit={(e) => void handleSave(e)}>
          <div className="docs-row-form">
            <label className="field">
              <span>Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Estado de medidores"
                required
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Descripción (opcional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Breve detalle del propósito de este tipo"
              />
            </label>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(deleteId)}
        title="Eliminar tipo"
        description="Se eliminarán también sus columnas y registros."
        danger
        onClose={() => setDeleteId(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setDeleteId(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--soft-rose"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              Eliminar
            </button>
          </>
        }
      >
        <p>¿Seguro que quieres eliminar este tipo de documentación?</p>
      </AppModal>
    </section>
  )
}
