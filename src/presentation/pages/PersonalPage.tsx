import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { CatalogItem } from '@/domain/entities/CatalogItem'
import type { OperationalRole } from '@/domain/entities/OperationalRole'
import type { Personal, PersonalInput } from '@/domain/entities/Personal'
import { personalFullName } from '@/domain/entities/Personal'
import { DomainError } from '@/domain/errors/DomainError'
import {
  PERSONAL_CONDITIONS,
  personalConditionLabel,
} from '@/domain/value-objects/PersonalCondition'
import { canManageOperationalRoles, canManageUsers, UserRole } from '@/domain/value-objects/UserRole'
import { isElectricistaTechnicianCargo } from '@/domain/value-objects/TechnicianLogin'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { PersonalOrgNav } from '@/presentation/components/PersonalOrgNav'
import { AppModal } from '@/presentation/components/AppModal'
import { parsePersonalExcel } from '@/infrastructure/excel/parsePersonalExcel'
import {
  swalConfirm,
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="personal-search__icon">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
      />
    </svg>
  )
}

function sortPeople(items: Personal[]): Personal[] {
  return [...items].sort((left, right) =>
    personalFullName(left).localeCompare(personalFullName(right), 'es'),
  )
}

function normalizePersonText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

const EMPTY_FORM: PersonalInput = {
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  dni: '',
  cargoId: '',
  localidadId: '',
  condicion: 'VIGENTE',
  roleId: '',
}

export function PersonalPage() {
  const { user } = useAuth()
  const {
    listPersonalUseCase,
    createPersonalUseCase,
    updatePersonalUseCase,
    deletePersonalUseCase,
    importPersonalUseCase,
    catalogCargosUseCase,
    catalogLocalidadesUseCase,
    listOperationalRolesUseCase,
    provisionElectricistaTechniciansUseCase,
  } = useDependencies()

  const canManage = Boolean(user && canManageUsers(user.role))
  const canAssignSuperAdmin = Boolean(
    user && canManageOperationalRoles(user.role),
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [people, setPeople] = useState<Personal[]>([])
  const [cargos, setCargos] = useState<CatalogItem[]>([])
  const [localidades, setLocalidades] = useState<CatalogItem[]>([])
  const [roles, setRoles] = useState<OperationalRole[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cargoFilter, setCargoFilter] = useState('')
  const [localidadFilter, setLocalidadFilter] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Personal | null>(null)
  const [form, setForm] = useState<PersonalInput>(EMPTY_FORM)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return people.filter((person) => {
      if (cargoFilter && person.cargoId !== cargoFilter) return false
      if (localidadFilter && person.localidadId !== localidadFilter) return false
      if (!query) return true
      const haystack =
        `${personalFullName(person)} ${person.dni} ${person.cargoName} ${person.localidadName} ${person.roleName}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [people, deferredSearch, cargoFilter, localidadFilter])

  async function loadAll() {
    if (!user) return
    setLoading(true)
    try {
      const [peopleResult, cargosResult, localidadesResult, rolesResult] =
        await Promise.allSettled([
          listPersonalUseCase.execute(user),
          catalogCargosUseCase.list(user),
          catalogLocalidadesUseCase.list(user),
          listOperationalRolesUseCase.execute(user),
        ])

      if (peopleResult.status === 'rejected') {
        const reason = peopleResult.reason
        throw reason
      }
      setPeople(peopleResult.value)
      setCargos(cargosResult.status === 'fulfilled' ? cargosResult.value : [])
      setLocalidades(
        localidadesResult.status === 'fulfilled' ? localidadesResult.value : [],
      )
      setRoles(rolesResult.status === 'fulfilled' ? rolesResult.value : [])
    } catch (err) {
      const message =
        err instanceof DomainError
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'No se pudo cargar el personal'
      swalError(message)
    } finally {
      setLoading(false)
    }
  }

  async function syncAppAccount(person: Personal) {
    if (!user || !canManage || person.condicion === 'RETIRADO' || !person.roleId)
      return
    try {
      await provisionElectricistaTechniciansUseCase.ensureForPerson(user, person)
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo sincronizar la cuenta de acceso',
      )
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function openCreate() {
    setEditing(null)
    const cargoId = cargos[0]?.id ?? ''
    const cargo = cargos.find((item) => item.id === cargoId)
    const tecnico = roles.find((item) => item.code === UserRole.Tecnico)
    setForm({
      ...EMPTY_FORM,
      cargoId,
      localidadId: localidades[0]?.id ?? '',
      roleId:
        cargo && tecnico && isElectricistaTechnicianCargo(cargo.name)
          ? tecnico.id
          : '',
    })
    setModalOpen(true)
  }

  function openEdit(person: Personal) {
    setEditing(person)
    setForm({
      nombres: person.nombres,
      apellidoPaterno: person.apellidoPaterno,
      apellidoMaterno: person.apellidoMaterno,
      dni: person.dni,
      cargoId: person.cargoId,
      localidadId: person.localidadId,
      condicion: person.condicion || 'VIGENTE',
      roleId: person.roleId,
    })
    setModalOpen(true)
  }

  async function confirmDelete(person: Personal) {
    if (!user || importing) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar persona?',
      text: `${personalFullName(person)} (${person.dni}) se quitará de la relación.`,
    })
    if (!confirmed) return

    setPeople((current) => current.filter((item) => item.id !== person.id))
    swalSuccess('Persona eliminada')
    try {
      await deletePersonalUseCase.execute(user, person.id)
    } catch (err) {
      setPeople((current) => sortPeople([...current, person]))
      swalError(err instanceof DomainError ? err.message : 'No se pudo eliminar')
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || importing) return

    const cargo = cargos.find((item) => item.id === form.cargoId)
    const localidad = localidades.find((item) => item.id === form.localidadId)
    const role = roles.find((item) => item.id === form.roleId)
    if (!cargo || !localidad) {
      swalError('Selecciona un cargo y una localidad')
      return
    }

    const payload: PersonalInput = {
      nombres: normalizePersonText(form.nombres),
      apellidoPaterno: normalizePersonText(form.apellidoPaterno),
      apellidoMaterno: normalizePersonText(form.apellidoMaterno),
      dni: form.dni.replace(/\D/g, ''),
      cargoId: cargo.id,
      localidadId: localidad.id,
      condicion: form.condicion,
      roleId: form.roleId,
    }

    if (editing) {
      const previous = editing
      const optimistic: Personal = {
        ...previous,
        ...payload,
        cargoName: cargo.name,
        localidadName: localidad.name,
        roleId: role?.id ?? '',
        roleName: role?.name ?? '',
        updatedAt: new Date(),
      }
      setPeople((current) =>
        sortPeople(
          current.map((item) => (item.id === previous.id ? optimistic : item)),
        ),
      )
      setModalOpen(false)
      swalSuccess('Persona actualizada')
      void updatePersonalUseCase.execute(user, previous.id, payload).then(
        (updated) => {
          setPeople((current) =>
            sortPeople(
              current.map((item) => (item.id === updated.id ? updated : item)),
            ),
          )
            void syncAppAccount(updated)
        },
        (err: unknown) => {
          setPeople((current) =>
            sortPeople(
              current.map((item) => (item.id === previous.id ? previous : item)),
            ),
          )
          setEditing(previous)
          setForm({
            nombres: previous.nombres,
            apellidoPaterno: previous.apellidoPaterno,
            apellidoMaterno: previous.apellidoMaterno,
            dni: previous.dni,
            cargoId: previous.cargoId,
            localidadId: previous.localidadId,
            condicion: previous.condicion || 'VIGENTE',
            roleId: previous.roleId,
          })
          setModalOpen(true)
          swalError(
            err instanceof DomainError ? err.message : 'No se pudo guardar',
          )
        },
      )
      return
    }

    const tempId = `temp:${crypto.randomUUID()}`
    const optimistic: Personal = {
      id: tempId,
      ...payload,
      cargoName: cargo.name,
      localidadName: localidad.name,
      roleId: role?.id ?? '',
      roleName: role?.name ?? '',
      createdById: user.id,
      createdByName: user.displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setPeople((current) => sortPeople([...current, optimistic]))
    setModalOpen(false)
    setForm(EMPTY_FORM)
    swalSuccess('Persona creada')
    void createPersonalUseCase.execute(user, payload).then(
      (created) => {
        setPeople((current) =>
          sortPeople(
            current.map((item) => (item.id === tempId ? created : item)),
          ),
        )
            void syncAppAccount(created)
      },
      (err: unknown) => {
        setPeople((current) => current.filter((item) => item.id !== tempId))
        setEditing(null)
        setForm(payload)
        setModalOpen(true)
        swalError(
          err instanceof DomainError ? err.message : 'No se pudo guardar',
        )
      },
    )
  }

  async function handleImport(file: File) {
    if (!user || busy || importing) return
    const confirmed = await swalConfirm({
      title: '¿Importar Excel de personal?',
      text: 'Se crean cargos y localidades si faltan. No se usa la columna de fecha ingreso/salida. El DNI actualiza a quien ya exista.',
      confirmButtonText: 'Sí, importar',
    })
    if (!confirmed) return

    setBusy(true)
    setImporting(true)
    setProgress({ done: 0, total: 0 })
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parsePersonalExcel(buffer)
      const result = await importPersonalUseCase.execute(
        user,
        parsed.rows,
        parsed.skipped,
        (done, total) => setProgress({ done, total }),
      )
      await loadAll()
      swalSuccess(
        `Listo: ${result.created} altas, ${result.updated} actualizaciones. Cargos nuevos: ${result.cargosCreated}. Localidades nuevas: ${result.localidadesCreated}.`,
      )
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo importar el Excel',
      )
    } finally {
      setBusy(false)
      setImporting(false)
      setProgress({ done: 0, total: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const workInProgress = importing
  const progressPercent =
    workInProgress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0
  const progressLabel =
    workInProgress && progress.total > 0
      ? `${progress.done.toLocaleString('es-PE')} / ${progress.total.toLocaleString('es-PE')} (${progressPercent}%)`
      : ''

  if (!user) return null

  return (
    <section className="personal-page">
      <header className="page-header">
        <div>
          <p className="personal-page__eyebrow">Organización</p>
          <h1>Personal</h1>
          <p>
            Relación de personal. Aquí se crea, edita y asigna el rol. Si el rol
            es Técnico, se genera la cuenta de la app. El restablecer clave y
            desactivar está en Cuentas app.
          </p>
        </div>
        <div className="personal-page__actions">
          <PersonalOrgNav />
        </div>
      </header>

      {importing ? (
        <div className="personal-progress" role="status">
          <div
            className="personal-progress__bar"
            style={{ width: progress.total > 0 ? `${progressPercent}%` : '8%' }}
          />
          <p>
            Importando personal…
            {progressLabel ? ` ${progressLabel}` : ''}
          </p>
        </div>
      ) : null}

      {!loading ? (
        <div className="personal-kpis">
          <div className="personal-kpis__item">
            <strong>{people.length}</strong>
            <span>Personas</span>
          </div>
          <div className="personal-kpis__item">
            <strong>{cargos.length}</strong>
            <span>Cargos</span>
          </div>
          <div className="personal-kpis__item">
            <strong>{localidades.length}</strong>
            <span>Localidades</span>
          </div>
        </div>
      ) : null}

      {!loading && (people.length > 0 || canManage) ? (
        <div className="personal-toolbar">
          <label className="personal-search">
            <IconSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, DNI, cargo o localidad…"
              autoComplete="off"
            />
          </label>
          {people.length > 0 ? (
            <>
              <select
                value={cargoFilter}
                onChange={(event) => setCargoFilter(event.target.value)}
              >
                <option value="">Todos los cargos</option>
                {cargos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={localidadFilter}
                onChange={(event) => setLocalidadFilter(event.target.value)}
              >
                <option value="">Todas las localidades</option>
                {localidades.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {canManage ? (
            <div className="personal-toolbar__actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleImport(file)
                }}
              />
              <button
                type="button"
                className="btn btn--soft-muted"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? 'Importando...' : 'Importar Excel'}
              </button>
              <button
                type="button"
                className="btn btn--soft-primary"
                disabled={importing}
                onClick={openCreate}
              >
                <IconPlus />
                Nueva persona
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="personal-empty">Cargando…</p>
      ) : people.length === 0 ? (
        <div className="personal-empty">
          <h2>Sin personal</h2>
          <p>
            Importa <strong>RELACION DE PERSONAL AGOSTO.xlsx</strong> o crea
            una persona. Antes conviene tener cargos y localidades, o déjalos
            nacer con la importación.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="personal-empty">No hay coincidencias con el filtro.</p>
      ) : (
        <div className="personal-table-wrap">
          <table className="personal-table">
            <thead>
              <tr>
                <th>Nombres</th>
                <th>Apellidos</th>
                <th>DNI</th>
                <th>Cargo</th>
                <th>Localidad</th>
                <th>Rol</th>
                <th>Condición</th>
                {canManage ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr key={person.id}>
                  <td>
                    <strong>{person.nombres}</strong>
                  </td>
                  <td>
                    {person.apellidoPaterno} {person.apellidoMaterno}
                  </td>
                  <td>{person.dni}</td>
                  <td>{person.cargoName}</td>
                  <td>{person.localidadName}</td>
                  <td>{person.roleName || '—'}</td>
                  <td>
                    <span
                      className={`personal-chip${
                        person.condicion === 'RETIRADO'
                          ? ' personal-chip--retirado'
                          : person.condicion === 'INGRESO'
                            ? ' personal-chip--ingreso'
                            : ''
                      }`}
                    >
                      {personalConditionLabel(person.condicion)}
                    </span>
                  </td>
                  {canManage ? (
                    <td>
                      <div className="personal-table__actions">
                        <button
                          type="button"
                          className="btn btn--icon-only btn--soft-blue"
                          title="Editar"
                          onClick={() => openEdit(person)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="btn btn--icon-only btn--soft-rose"
                          title="Eliminar"
                          onClick={() => void confirmDelete(person)}
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
        title={editing ? 'Editar persona' : 'Nueva persona'}
        description="La fecha de ingreso o salida no se registra."
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
              form="personal-form"
              className="btn btn--soft-primary"
            >
              Guardar
            </button>
          </>
        }
      >
        <form
          id="personal-form"
          className="personal-form"
          onSubmit={handleSave}
        >
          <div className="personal-form__grid">
            <label className="field">
              <span>Nombres</span>
              <input
                value={form.nombres}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nombres: event.target.value }))
                }
                required
                maxLength={80}
              />
            </label>
            <label className="field">
              <span>DNI</span>
              <input
                value={form.dni}
                inputMode="numeric"
                onChange={(event) =>
                  setForm((current) => ({ ...current, dni: event.target.value }))
                }
                required
                maxLength={8}
              />
            </label>
            <label className="field">
              <span>Apellido paterno</span>
              <input
                value={form.apellidoPaterno}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apellidoPaterno: event.target.value,
                  }))
                }
                required
                maxLength={60}
              />
            </label>
            <label className="field">
              <span>Apellido materno</span>
              <input
                value={form.apellidoMaterno}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apellidoMaterno: event.target.value,
                  }))
                }
                required
                maxLength={60}
              />
            </label>
            <label className="field">
              <span>Cargo</span>
              <select
                value={form.cargoId}
                onChange={(event) => {
                  const cargoId = event.target.value
                  const cargo = cargos.find((item) => item.id === cargoId)
                  const tecnico = roles.find((item) => item.code === UserRole.Tecnico)
                  setForm((current) => ({
                    ...current,
                    cargoId,
                    roleId:
                      !current.roleId &&
                      cargo &&
                      tecnico &&
                      isElectricistaTechnicianCargo(cargo.name)
                        ? tecnico.id
                        : current.roleId,
                  }))
                }}
                required
              >
                <option value="">Selecciona</option>
                {cargos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Localidad</span>
              <select
                value={form.localidadId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    localidadId: event.target.value,
                  }))
                }
                required
              >
                <option value="">Selecciona</option>
                {localidades.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Rol operativo</span>
              <select
                value={form.roleId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    roleId: event.target.value,
                  }))
                }
              >
                <option value="">Sin asignar</option>
                {roles.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={
                      item.code === UserRole.SuperAdministrador &&
                      !canAssignSuperAdmin
                    }
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Condición</span>
              <select
                value={form.condicion}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    condicion: event.target.value as PersonalInput['condicion'],
                  }))
                }
              >
                {PERSONAL_CONDITIONS.map((item) => (
                  <option key={item} value={item}>
                    {personalConditionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
      </AppModal>
    </section>
  )
}
