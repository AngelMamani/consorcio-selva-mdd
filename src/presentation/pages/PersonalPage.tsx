import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { saveAs } from 'file-saver'
import type { CatalogItem } from '@/domain/entities/CatalogItem'
import type { OperationalRole } from '@/domain/entities/OperationalRole'
import type { Personal, PersonalInput } from '@/domain/entities/Personal'
import { personalFullName, personalRoleIds } from '@/domain/entities/Personal'
import { DomainError } from '@/domain/errors/DomainError'
import {
  PERSONAL_CONDITIONS,
  personalConditionLabel,
} from '@/domain/value-objects/PersonalCondition'
import { canManageOperationalRoles, canManageUsers, isUserRole, UserRole, userRoleAccessHint } from '@/domain/value-objects/UserRole'
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
import './PersonalPage.css'

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

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5z"
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

const PAGE_SIZE = 10

function sortPeople(items: Personal[]): Personal[] {
  return [...items].sort((left, right) =>
    personalFullName(left).localeCompare(personalFullName(right), 'es'),
  )
}

function normalizePersonText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

function personInitials(person: Personal): string {
  const first = person.nombres.trim().charAt(0)
  const last = person.apellidoPaterno.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || 'P'
}

function roleChipClass(code: string): string {
  if (!code) return ' personal-chip--muted'
  if (code === UserRole.SuperAdministrador) return ' personal-chip--super'
  if (code === UserRole.Administrador) return ' personal-chip--admin'
  if (code === UserRole.Tecnico) return ' personal-chip--tech'
  return ''
}

function conditionChipClass(value: string): string {
  if (value === 'RETIRADO') return ' personal-chip--retirado'
  if (value === 'INGRESO') return ' personal-chip--ingreso'
  if (value === 'VIGENTE') return ' personal-chip--vigente'
  return ' personal-chip--muted'
}

function pageWindow(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }
  const marks = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...marks]
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right)
  const items: Array<number | 'ellipsis'> = []
  for (const page of sorted) {
    const previous = items[items.length - 1]
    if (typeof previous === 'number' && page - previous > 1) {
      items.push('ellipsis')
    }
    items.push(page)
  }
  return items
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
    exportPersonalToExcelUseCase,
    exportPersonalToPdfUseCase,
    catalogCargosUseCase,
    catalogLocalidadesUseCase,
    listOperationalRolesUseCase,
    ensureDefaultOperationalRolesUseCase,
    assignPersonalRoleUseCase,
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
  const [roleFilter, setRoleFilter] = useState('')
  const [condicionFilter, setCondicionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const deferredSearch = useDeferredValue(searchTerm)

  const [modalOpen, setModalOpen] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editing, setEditing] = useState<Personal | null>(null)
  const [assigning, setAssigning] = useState<Personal | null>(null)
  const [form, setForm] = useState<PersonalInput>(EMPTY_FORM)
  const [assignRoleIds, setAssignRoleIds] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const assignableRoles = useMemo(() => {
    const byCode = (code: string) =>
      roles.find((item) => item.code.trim().toUpperCase() === code)
    const byName = (needle: string) =>
      roles.find((item) => {
        const name = item.name
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        return name === needle
      })

    const picked = [
      byCode(UserRole.SuperAdministrador) ?? byName('super administrador'),
      byCode(UserRole.Administrador) ?? byName('administrador'),
      byCode(UserRole.Tecnico) ?? byName('tecnico'),
    ].filter((item): item is OperationalRole => item != null)

    return picked.length > 0 ? picked : roles
  }, [roles])

  const withoutRoleCount = people.filter(
    (item) => personalRoleIds(item).length === 0,
  ).length
  const vigenteCount = people.filter((item) => item.condicion === 'VIGENTE').length
  const retiradoCount = people.filter(
    (item) => item.condicion === 'RETIRADO',
  ).length

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return people.filter((person) => {
      if (cargoFilter && person.cargoId !== cargoFilter) return false
      if (localidadFilter && person.localidadId !== localidadFilter) return false
      if (condicionFilter && person.condicion !== condicionFilter) return false
      if (roleFilter === 'none' && personalRoleIds(person).length > 0) return false
      if (
        roleFilter &&
        roleFilter !== 'none' &&
        !personalRoleIds(person).includes(roleFilter)
      ) {
        return false
      }
      if (!query) return true
      const haystack =
        `${personalFullName(person)} ${person.dni} ${person.cargoName} ${person.localidadName} ${person.roleName} ${(person.roleNames ?? []).join(' ')}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [
    people,
    deferredSearch,
    cargoFilter,
    localidadFilter,
    roleFilter,
    condicionFilter,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE)
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1
  const rangeTo = pageStart + paged.length
  const pagerPages = pageWindow(currentPage, totalPages)

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, cargoFilter, localidadFilter, roleFilter, condicionFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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
      if (
        rolesResult.status === 'fulfilled' &&
        rolesResult.value.length === 0
      ) {
        try {
          const ensured = await ensureDefaultOperationalRolesUseCase.execute(user)
          setRoles(ensured)
        } catch {
          // Solo Super Administrador puede crear los roles base.
        }
      }
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
    if (
      !user ||
      !canManage ||
      person.condicion === 'RETIRADO' ||
      personalRoleIds(person).length === 0
    )
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
    setForm({
      ...EMPTY_FORM,
      cargoId: cargos[0]?.id ?? '',
      localidadId: localidades[0]?.id ?? '',
      roleId: '',
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

  function openAssign(person: Personal) {
    const currentIds = personalRoleIds(person)
    const hasSuper = currentIds.some((id) => {
      const role = roles.find((item) => item.id === id)
      return role?.code === UserRole.SuperAdministrador
    })
    if (hasSuper && !canAssignSuperAdmin) {
      swalError('Solo el Super Administrador puede cambiar este rol')
      return
    }
    setAssigning(person)
    setAssignRoleIds(currentIds)
    setRoleModalOpen(true)
  }

  async function confirmDelete(person: Personal) {
    if (!user || importing) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar persona?',
      text: `${personalFullName(person)} (${person.dni}) se quitará de Recursos Humanos. Si tiene cuenta de acceso, también se eliminará.`,
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
      roleId: editing?.roleId ?? '',
    }

    if (editing) {
      const previous = editing
      const optimistic: Personal = {
        ...previous,
        ...payload,
        cargoName: cargo.name,
        localidadName: localidad.name,
        roleId: previous.roleId,
        roleName: previous.roleName,
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
      roleId: '',
      roleName: '',
      roleIds: [],
      roleNames: [],
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

  function handleAssignRole(event: FormEvent) {
    event.preventDefault()
    if (!user || !assigning || importing) return

    const selected = assignRoleIds
      .map(
        (id) =>
          assignableRoles.find((item) => item.id === id) ??
          roles.find((item) => item.id === id),
      )
      .filter((item): item is OperationalRole => item != null)

    if (selected.length === 0) {
      swalError('Selecciona al menos un rol: Super Administrador, Administrador o Técnico')
      return
    }
    if (selected.length > 3) {
      swalError('Una persona puede tener como máximo 3 roles')
      return
    }

    const previousIds = personalRoleIds(assigning)
    const previousHadSuper = previousIds.some(
      (id) =>
        roles.find((item) => item.id === id)?.code ===
        UserRole.SuperAdministrador,
    )
    const nextHasSuper = selected.some(
      (item) => item.code === UserRole.SuperAdministrador,
    )
    if ((previousHadSuper || nextHasSuper) && !canAssignSuperAdmin) {
      swalError('Solo el Super Administrador puede asignar o cambiar Super Administrador')
      return
    }

    const previous = assigning
    const optimistic: Personal = {
      ...previous,
      roleId: selected[0].id,
      roleName: selected.map((item) => item.name).join(' · '),
      roleIds: selected.map((item) => item.id),
      roleNames: selected.map((item) => item.name),
      updatedAt: new Date(),
    }
    setPeople((current) =>
      sortPeople(
        current.map((item) => (item.id === previous.id ? optimistic : item)),
      ),
    )
    setRoleModalOpen(false)
    setAssigning(null)
    swalSuccess(
      selected.length === 1 ? 'Rol asignado' : 'Roles asignados',
    )
    void assignPersonalRoleUseCase
      .execute(
        user,
        previous.id,
        selected.map((item) => item.id),
      )
      .then(
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
          setAssigning(previous)
          setAssignRoleIds(selected.map((item) => item.id))
          setRoleModalOpen(true)
          const firebaseCode =
            typeof err === 'object' && err && 'code' in err
              ? String((err as { code: string }).code)
              : ''
          swalError(
            err instanceof DomainError
              ? err.message
              : firebaseCode === 'permission-denied'
                ? 'Firebase no permitió guardar el rol. Vuelve a intentar.'
                : err instanceof Error && err.message
                  ? err.message
                  : 'No se pudo asignar el rol',
          )
        },
      )
  }

  async function handleImport(file: File) {
    if (!user || busy || importing) return
    const confirmed = await swalConfirm({
      title: '¿Importar Excel de personal?',
      text: 'Se crean cargos y localidades si faltan. No se asigna rol: eso se hace después, persona por persona. El DNI actualiza a quien ya exista.',
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

  function clearListFilters() {
    setRoleFilter('')
    setCargoFilter('')
    setLocalidadFilter('')
    setCondicionFilter('')
    setSearchTerm('')
  }

  function exportFilterLabel(): string {
    const parts: string[] = []
    if (deferredSearch.trim()) {
      parts.push(`Búsqueda: ${deferredSearch.trim()}`)
    }
    if (cargoFilter) {
      parts.push(
        `Cargo: ${cargos.find((item) => item.id === cargoFilter)?.name ?? cargoFilter}`,
      )
    }
    if (localidadFilter) {
      parts.push(
        `Localidad: ${localidades.find((item) => item.id === localidadFilter)?.name ?? localidadFilter}`,
      )
    }
    if (roleFilter === 'none') {
      parts.push('Rol: sin asignar')
    } else if (roleFilter) {
      parts.push(
        `Rol: ${roles.find((item) => item.id === roleFilter)?.name ?? roleFilter}`,
      )
    }
    if (condicionFilter) {
      parts.push(`Condición: ${personalConditionLabel(condicionFilter)}`)
    }
    return parts.length > 0 ? parts.join(' · ') : 'Todo el personal'
  }

  async function handleExportExcel() {
    if (!user || exporting) return
    setExporting('excel')
    try {
      const file = exportPersonalToExcelUseCase.execute(user, filtered, {
        filterLabel: exportFilterLabel(),
        rosterCount: people.length,
      })
      saveAs(file.blob, file.fileName)
      swalSuccess('Excel de personal descargado')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo exportar el Excel',
      )
    } finally {
      setExporting(null)
    }
  }

  async function handleExportPdf() {
    if (!user || exporting) return
    setExporting('pdf')
    try {
      const file = exportPersonalToPdfUseCase.execute(user, filtered, {
        filterLabel: exportFilterLabel(),
        rosterCount: people.length,
      })
      saveAs(file.blob, file.fileName)
      swalSuccess('PDF de personal descargado')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo exportar el PDF',
      )
    } finally {
      setExporting(null)
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

  function personActions(person: Personal) {
    return (
      <div className="hr-table__actions">
        <button
          type="button"
          className="btn btn--small btn--soft-amber"
          disabled={importing || exporting !== null}
          onClick={() => openAssign(person)}
        >
          <IconShield />
          {personalRoleIds(person).length > 0 ? 'Cambiar roles' : 'Asignar roles'}
        </button>
        <button
          type="button"
          className="btn btn--small btn--soft-blue"
          disabled={importing || exporting !== null}
          onClick={() => openEdit(person)}
        >
          <IconEdit />
          Editar
        </button>
        <button
          type="button"
          className="btn btn--icon-only btn--soft-rose"
          title="Eliminar"
          disabled={importing || exporting !== null}
          onClick={() => void confirmDelete(person)}
        >
          <IconTrash />
        </button>
      </div>
    )
  }

  if (!user) return null

  const filtersIdle =
    !roleFilter && !cargoFilter && !localidadFilter && !condicionFilter && !searchTerm
  const canExport = !loading && filtered.length > 0 && exporting === null && !importing

  return (
    <section className="personal-page">
      <header className="page-header">
        <div>
          <p className="personal-page__eyebrow">Organización</p>
          <h1>Recursos Humanos</h1>
          <p>
            Una ficha por persona (DNI). Primero se registra; después se le
            asigna el rol y nace la cuenta de acceso.
          </p>
        </div>
        <div className="personal-page__actions">
          <button
            type="button"
            className="btn btn--soft-muted"
            disabled={!canExport}
            onClick={() => void handleExportExcel()}
          >
            {exporting === 'excel' ? 'Generando Excel...' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            className="btn btn--soft-teal"
            disabled={!canExport}
            onClick={() => void handleExportPdf()}
          >
            {exporting === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}
          </button>
          {canManage ? (
            <button
              type="button"
              className="btn btn--soft-primary"
              disabled={importing || exporting !== null}
              onClick={openCreate}
            >
              <IconPlus />
              Registrar persona
            </button>
          ) : null}
        </div>
      </header>

      <PersonalOrgNav />

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
          <button
            type="button"
            className={`personal-kpis__item${filtersIdle ? ' is-active' : ''}`}
            onClick={clearListFilters}
          >
            <strong>{people.length}</strong>
            <span>Personas</span>
          </button>
          <button
            type="button"
            className={`personal-kpis__item personal-kpis__item--ok${
              condicionFilter === 'VIGENTE' ? ' is-active' : ''
            }`}
            onClick={() => setCondicionFilter('VIGENTE')}
          >
            <strong>{vigenteCount}</strong>
            <span>Vigentes</span>
          </button>
          <button
            type="button"
            className={`personal-kpis__item personal-kpis__item--warn${
              roleFilter === 'none' ? ' is-active' : ''
            }`}
            onClick={() => setRoleFilter('none')}
          >
            <strong>{withoutRoleCount}</strong>
            <span>Sin rol</span>
          </button>
          <button
            type="button"
            className={`personal-kpis__item personal-kpis__item--danger${
              condicionFilter === 'RETIRADO' ? ' is-active' : ''
            }`}
            onClick={() => setCondicionFilter('RETIRADO')}
          >
            <strong>{retiradoCount}</strong>
            <span>Retirados</span>
          </button>
        </div>
      ) : null}

      {!loading && (people.length > 0 || canManage) ? (
        <div className="personal-toolbar">
          <div className="personal-toolbar__row">
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
                  disabled={importing || exporting !== null}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importing ? 'Importando...' : 'Importar Excel'}
                </button>
              </div>
            ) : null}
          </div>
          {people.length > 0 ? (
            <div className="personal-toolbar__row">
              <label className="personal-filter">
                <span>Cargo</span>
                <select
                  value={cargoFilter}
                  onChange={(event) => setCargoFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {cargos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="personal-filter">
                <span>Localidad</span>
                <select
                  value={localidadFilter}
                  onChange={(event) => setLocalidadFilter(event.target.value)}
                >
                  <option value="">Todas</option>
                  {localidades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="personal-filter">
                <span>Rol</span>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="none">Sin asignar</option>
                  {assignableRoles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="personal-filter">
                <span>Condición</span>
                <select
                  value={condicionFilter}
                  onChange={(event) => setCondicionFilter(event.target.value)}
                >
                  <option value="">Todas</option>
                  {PERSONAL_CONDITIONS.map((item) => (
                    <option key={item} value={item}>
                      {personalConditionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              {!filtersIdle ? (
                <button
                  type="button"
                  className="btn btn--small btn--soft-muted personal-toolbar__clear"
                  onClick={clearListFilters}
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="personal-empty">Cargando listado…</p>
      ) : people.length === 0 ? (
        <div className="personal-empty">
          <h2>Aún no hay personal</h2>
          <p>
            Usa Registrar persona o Importar Excel. Los roles se asignan
            después, en cada ficha.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="personal-empty">
          <h2>Nadie coincide con el filtro</h2>
          <p>
            Hay {people.length} persona{people.length === 1 ? '' : 's'} en el
            listado. Prueba otra búsqueda o limpia los filtros.
          </p>
          <button
            type="button"
            className="btn btn--soft-muted"
            onClick={clearListFilters}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="hr-list">
          <div className="hr-list__meta">
            <p>
              Ordenado A–Z ·{' '}
              <strong>
                {rangeFrom}–{rangeTo}
              </strong>{' '}
              de <strong>{filtered.length}</strong>
              {filtered.length !== people.length
                ? ` (de ${people.length} en RR.HH.)`
                : ''}
            </p>
            <p>{PAGE_SIZE} por página</p>
          </div>
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th className="hr-table__num">N.º</th>
                  <th>Persona</th>
                  <th>Cargo</th>
                  <th>Localidad</th>
                  <th>Rol</th>
                  <th>Condición</th>
                  {canManage ? <th>Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {paged.map((person, index) => {
                  return (
                    <tr key={person.id}>
                      <td className="hr-table__num">{pageStart + index + 1}</td>
                      <td>
                        <div className="hr-person">
                          <span className="hr-person__avatar" aria-hidden="true">
                            {personInitials(person)}
                          </span>
                          <div>
                            <strong>{personalFullName(person)}</strong>
                            <small>DNI {person.dni}</small>
                          </div>
                        </div>
                      </td>
                      <td>{person.cargoName}</td>
                      <td>{person.localidadName}</td>
                      <td>
                        <div className="hr-role-chips">
                          {personalRoleIds(person).length === 0 ? (
                            <span className="personal-chip personal-chip--muted">
                              Sin asignar
                            </span>
                          ) : (
                            personalRoleIds(person).map((roleId) => {
                              const role = roles.find((item) => item.id === roleId)
                              return (
                                <span
                                  key={roleId}
                                  className={`personal-chip${roleChipClass(role?.code ?? '')}`}
                                >
                                  {role?.name || 'Rol'}
                                </span>
                              )
                            })
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`personal-chip${conditionChipClass(person.condicion)}`}>
                          {personalConditionLabel(person.condicion)}
                        </span>
                      </td>
                      {canManage ? <td>{personActions(person)}</td> : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="hr-cards">
            {paged.map((person, index) => {
              return (
                <article key={person.id} className="hr-card">
                  <div className="hr-card__top">
                    <span className="hr-card__index">
                      {pageStart + index + 1}
                    </span>
                    <span className="hr-person__avatar" aria-hidden="true">
                      {personInitials(person)}
                    </span>
                    <div>
                      <strong>{personalFullName(person)}</strong>
                      <small>DNI {person.dni}</small>
                    </div>
                  </div>
                  <dl className="hr-card__grid">
                    <div>
                      <dt>Cargo</dt>
                      <dd>{person.cargoName}</dd>
                    </div>
                    <div>
                      <dt>Localidad</dt>
                      <dd>{person.localidadName}</dd>
                    </div>
                    <div>
                      <dt>Rol</dt>
                      <dd>
                        <div className="hr-role-chips">
                          {personalRoleIds(person).length === 0 ? (
                            <span className="personal-chip personal-chip--muted">
                              Sin asignar
                            </span>
                          ) : (
                            personalRoleIds(person).map((roleId) => {
                              const role = roles.find((item) => item.id === roleId)
                              return (
                                <span
                                  key={roleId}
                                  className={`personal-chip${roleChipClass(role?.code ?? '')}`}
                                >
                                  {role?.name || 'Rol'}
                                </span>
                              )
                            })
                          )}
                        </div>
                      </dd>
                    </div>
                    <div>
                      <dt>Condición</dt>
                      <dd>
                        <span className={`personal-chip${conditionChipClass(person.condicion)}`}>
                          {personalConditionLabel(person.condicion)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {canManage ? personActions(person) : null}
                </article>
              )
            })}
          </div>
          {totalPages > 1 ? (
            <nav className="hr-pager" aria-label="Páginas del listado">
              <p className="hr-pager__status">
                Página {currentPage} de {totalPages}
              </p>
              <div className="hr-pager__controls">
                <button
                  type="button"
                  className="hr-pager__btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </button>
                {pagerPages.map((item, index) =>
                  item === 'ellipsis' ? (
                    <span key={`e-${index}`} className="hr-pager__ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`hr-pager__btn${
                        item === currentPage ? ' is-active' : ''
                      }`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="hr-pager__btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Siguiente
                </button>
              </div>
            </nav>
          ) : null}
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? 'Editar ficha' : 'Registrar persona'}
        description="Paso 1: datos de Recursos Humanos. El rol se asigna después."
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
              maxLength={60}
            />
          </label>
            <label className="field">
              <span>Cargo</span>
              <select
                value={form.cargoId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cargoId: event.target.value,
                  }))
                }
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

      <AppModal
        open={roleModalOpen}
        title={
          assigning && personalRoleIds(assigning).length > 0
            ? 'Cambiar roles'
            : 'Asignar roles'
        }
        description={
          assigning
            ? `Hasta 3 roles para ${personalFullName(assigning)}. Cada rol abre su interfaz.`
            : 'Hasta 3 roles de acceso.'
        }
        onClose={() => {
          setRoleModalOpen(false)
          setAssigning(null)
        }}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => {
                setRoleModalOpen(false)
                setAssigning(null)
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="assign-role-form"
              className="btn btn--soft-primary"
            >
              Guardar roles
            </button>
          </>
        }
      >
        <form
          id="assign-role-form"
          className="personal-form"
          onSubmit={handleAssignRole}
        >
          <div className="hr-role-options" role="group" aria-label="Roles de acceso">
            {assignableRoles.map((item) => {
              const blocked =
                item.code === UserRole.SuperAdministrador &&
                !canAssignSuperAdmin
              const selected = assignRoleIds.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  disabled={blocked}
                  className={`hr-role-option${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    setAssignRoleIds((current) => {
                      if (current.includes(item.id)) {
                        return current.filter((id) => id !== item.id)
                      }
                      if (current.length >= 3) return current
                      return [...current, item.id]
                    })
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {isUserRole(item.code)
                      ? userRoleAccessHint(item.code)
                      : item.code}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="field-hint">
            Super Administrador: solo web. Administrador: web y app. Técnico:
            solo app. Se puede marcar más de uno.
          </p>
          {assignableRoles.length === 0 ? (
            <p className="field-hint">
              No hay roles operativos en Firebase. Créalos en Sistema → Roles.
            </p>
          ) : null}
        </form>
      </AppModal>
    </section>
  )
}
