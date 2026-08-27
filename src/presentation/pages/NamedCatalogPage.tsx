import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { CatalogItem } from '@/domain/entities/CatalogItem'
import { DomainError } from '@/domain/errors/DomainError'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { PersonalOrgNav } from '@/presentation/components/PersonalOrgNav'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import type { CatalogCrudUseCases } from '@/domain/usecases/personal/CatalogUseCases'
import './CatalogPage.css'

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"
      />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3.5-9h1v8h-1zm4 0h1v8h-1zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="catalog-search__icon">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
      />
    </svg>
  )
}

interface NamedCatalogPageProps {
  title: string
  eyebrow: string
  description: string
  createLabel: string
  itemLabel: string
  useCase: CatalogCrudUseCases
}

export function NamedCatalogPage({
  title,
  eyebrow,
  description,
  createLabel,
  itemLabel,
  useCase,
}: NamedCatalogPageProps) {
  const { user } = useAuth()
  const canManage = Boolean(user && canManageUsers(user.role))
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [name, setName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) => item.name.toLowerCase().includes(query))
  }, [items, deferredSearch])

  async function loadItems() {
    if (!user) return
    setLoading(true)
    try {
      setItems(await useCase.list(user))
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : `No se pudo cargar ${title.toLowerCase()}`,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!modalOpen) return
    const id = window.setTimeout(() => nameInputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [modalOpen])

  function openCreate() {
    setEditing(null)
    setName('')
    setModalOpen(true)
  }

  function openEdit(item: CatalogItem) {
    setEditing(item)
    setName(item.name)
    setModalOpen(true)
  }

  async function confirmDelete(item: CatalogItem) {
    if (!user) return
    const confirmed = await swalConfirmDelete({
      title: `¿Eliminar ${itemLabel}?`,
      text: `"${item.name}" se eliminará si nadie lo usa.`,
    })
    if (!confirmed) return

    setItems((current) => current.filter((row) => row.id !== item.id))
    swalSuccess('Eliminado')
    try {
      await useCase.delete(user, item.id)
    } catch (err) {
      setItems((current) =>
        [...current, item].sort((left, right) =>
          left.name.localeCompare(right.name, 'es'),
        ),
      )
      swalError(err instanceof DomainError ? err.message : 'No se pudo eliminar')
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) return

    if (editing) {
      const previous = editing
      const optimistic: CatalogItem = {
        ...previous,
        name: trimmed,
        updatedAt: new Date(),
      }
      setItems((current) =>
        current
          .map((item) => (item.id === previous.id ? optimistic : item))
          .sort((left, right) => left.name.localeCompare(right.name, 'es')),
      )
      setModalOpen(false)
      swalSuccess('Actualizado')
      void useCase.update(user, previous.id, trimmed).then(
        (updated) => {
          setItems((current) =>
            current
              .map((item) => (item.id === updated.id ? updated : item))
              .sort((left, right) => left.name.localeCompare(right.name, 'es')),
          )
        },
        (err: unknown) => {
          setItems((current) =>
            current
              .map((item) => (item.id === previous.id ? previous : item))
              .sort((left, right) => left.name.localeCompare(right.name, 'es')),
          )
          setEditing(previous)
          setName(previous.name)
          setModalOpen(true)
          swalError(
            err instanceof DomainError ? err.message : 'No se pudo guardar',
          )
        },
      )
      return
    }

    const tempId = `temp:${crypto.randomUUID()}`
    const optimistic: CatalogItem = {
      id: tempId,
      name: trimmed,
      createdById: user.id,
      createdByName: user.displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setItems((current) =>
      [...current, optimistic].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
      ),
    )
    setModalOpen(false)
    setName('')
    swalSuccess('Creado')
    void useCase.create(user, trimmed).then(
      (created) => {
        setItems((current) =>
          current
            .map((item) => (item.id === tempId ? created : item))
            .sort((left, right) => left.name.localeCompare(right.name, 'es')),
        )
      },
      (err: unknown) => {
        setItems((current) => current.filter((item) => item.id !== tempId))
        setEditing(null)
        setName(trimmed)
        setModalOpen(true)
        swalError(err instanceof DomainError ? err.message : 'No se pudo guardar')
      },
    )
  }

  if (!user) return null

  return (
    <section className="catalog-page">
      <header className="page-header">
        <div>
          <p className="catalog-page__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="catalog-page__actions">
          <PersonalOrgNav />
          {canManage ? (
            <button
              type="button"
              className="btn btn--soft-primary"
              onClick={openCreate}
            >
              <IconPlus />
              {createLabel}
            </button>
          ) : null}
        </div>
      </header>

      {!loading && items.length > 0 ? (
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Buscar ${title.toLowerCase()}…`}
              autoComplete="off"
            />
          </label>
          <strong>{filtered.length}</strong>
        </div>
      ) : null}

      {loading ? (
        <p className="catalog-empty">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="catalog-empty">
          <h2>Sin registros</h2>
          <p>Crea el primero o importa el Excel desde Recursos Humanos.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="catalog-empty">Sin resultados para “{searchTerm.trim()}”.</p>
      ) : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Nombre</th>
                {canManage ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  {canManage ? (
                    <td>
                      <div className="catalog-table__actions">
                        <button
                          type="button"
                          className="btn btn--icon-only btn--soft-blue"
                          title="Editar"
                          onClick={() => openEdit(item)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="btn btn--icon-only btn--soft-rose"
                          title="Eliminar"
                          onClick={() => void confirmDelete(item)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? `Editar` : createLabel}
        size="sm"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="catalog-form"
              className="btn btn--soft-primary"
            >
              Guardar
            </button>
          </>
        }
      >
        <form id="catalog-form" onSubmit={handleSave}>
          <label className="field">
            <span>Nombre</span>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </label>
        </form>
      </AppModal>
    </section>
  )
}
