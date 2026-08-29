import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import type { Area } from '@/domain/entities/Area'
import { areaReportCode, isInstallationArea } from '@/domain/entities/Area'
import type {
  InstallationOrder,
  InstallationOrderDraft,
} from '@/domain/entities/InstallationOrder'
import {
  draftFromInstallationOrder,
  emptyInstallationOrderDraft,
  formatInstallationDate,
  formatInstallationDateTime,
  installationMeterTypeFromSubType,
  installationMeterTypeLabel,
  installationOrderStatusLabel,
  installationRegisteredFlag,
  installationSubTypeFromMeterType,
  INSTALLATION_METER_TYPE_OPTIONS,
  type InstallationMeterType,
} from '@/domain/entities/InstallationOrder'
import type { User } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { parseInstallationOrdersExcel } from '@/infrastructure/excel/parseInstallationOrdersExcel'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import { RegisteredFlagPicker } from '@/presentation/components/RegisteredFlagPicker'
import { SupplyCatalogSearch } from '@/presentation/components/SupplyCatalogSearch'
import { TechnicianSearchSelect } from '@/presentation/components/TechnicianSearchSelect'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './InstallationOrdersPage.css'

type StatusFilter = 'all' | 'PROGRAMADO' | 'NO_REGISTRADO'

function toDateInput(date: Date | null): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateInput(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3m-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3m0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13m8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5"
      />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m3.3 13.3-1.4 1.4L12 13.4l-1.9 1.9-1.4-1.4 1.9-1.9-1.9-1.9 1.4-1.4 1.9 1.9 1.9-1.9 1.4 1.4-1.9 1.9z"
      />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 7V3H2v18h20V7zm-6 12H4v-2h2zm0-4H4v-2h2zm0-4H4V9h2zm0-4H4V5h2zm4 12H8v-2h2zm0-4H8v-2h2zm0-4H8V9h2zm0-4H8V5h2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8z"
      />
    </svg>
  )
}

function StatusBadge({ order }: { order: InstallationOrder }) {
  const programmed = order.status === 'PROGRAMADO'
  return (
    <span
      className={`io-status ${programmed ? 'io-status--on' : 'io-status--off'}`}
    >
      {programmed ? <IconPlay /> : <IconClose />}
      {installationOrderStatusLabel(order.status)}
    </span>
  )
}

function DetailField({
  label,
  children,
  icon,
}: {
  label: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="io-detail__field">
      <span>{label}</span>
      <strong>
        {icon}
        {children}
      </strong>
    </div>
  )
}

export function InstallationOrdersPage() {
  const { areaId = '' } = useParams()
  return <InstallationOrdersBoard areaId={areaId} mode="view" />
}

export function InstallationOrdersBoard({
  areaId,
  mode = 'assign',
  embedded = false,
}: {
  areaId: string
  mode?: 'assign' | 'view'
  embedded?: boolean
}) {
  const { user } = useAuth()
  const {
    getAreaUseCase,
    listTechniciansUseCase,
    listInstallationOrdersUseCase,
    upsertInstallationOrderUseCase,
    updateInstallationOrderUseCase,
    assignInstallationOrderUseCase,
    deleteInstallationOrderUseCase,
    importInstallationOrdersUseCase,
    exportInstallationOrdersToPdfUseCase,
    exportInstallationOrdersToExcelUseCase,
  } = useDependencies()

  const [area, setArea] = useState<Area | null>(null)
  const [orders, setOrders] = useState<InstallationOrder[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InstallationOrder | null>(null)
  const [draft, setDraft] = useState<InstallationOrderDraft>(
    emptyInstallationOrderDraft(),
  )
  const importInputRef = useRef<HTMLInputElement>(null)
  const deferredSearch = useDeferredValue(searchTerm)
  const isAdmin = Boolean(user && canManageUsers(user.role))
  const canAssign = isAdmin && mode === 'assign'

  const selected = orders.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    if (!user || !areaId) return
    let stop = () => {}
    setLoading(true)
    void (async () => {
      try {
        const [nextArea, nextTechnicians] = await Promise.all([
          getAreaUseCase.execute(user, areaId),
          listTechniciansUseCase.execute(user),
        ])
        setArea(nextArea)
        setTechnicians(nextTechnicians)
        stop = listInstallationOrdersUseCase.watch(
          user,
          areaId,
          (next) => {
            setOrders(next)
            setLoading(false)
          },
          (error) => {
            setLoading(false)
            swalError(error.message)
          },
        )
      } catch (err) {
        setLoading(false)
        swalError(
          err instanceof DomainError
            ? err.message
            : 'No se pudieron cargar las órdenes',
        )
      }
    })()
    return () => stop()
  }, [
    user,
    areaId,
    getAreaUseCase,
    listTechniciansUseCase,
    listInstallationOrdersUseCase,
  ])

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (technicianFilter && order.technicianId !== technicianFilter) return false
      if (!query) return true
      const haystack = [
        order.orderNumber,
        order.applicantName,
        order.applicantAddress,
        order.supplyCode,
        order.neighborRouteCode,
        order.technicianName,
        order.sector,
        order.subType,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [orders, deferredSearch, statusFilter, technicianFilter])

  const programmedCount = orders.filter((item) => item.status === 'PROGRAMADO').length

  function openCreate() {
    setEditing(null)
    setDraft({
      ...emptyInstallationOrderDraft(),
      sectorCijp: '',
      attentionCenter: '',
    })
    setModalOpen(true)
  }

  function openEdit(order: InstallationOrder) {
    setEditing(order)
    setDraft(draftFromInstallationOrder(order))
    setModalOpen(true)
  }

  function patchDraft(partial: Partial<InstallationOrderDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || busy || !canAssign) return
    setBusy(true)
    try {
      if (editing) {
        await updateInstallationOrderUseCase.execute(user, editing.id, draft)
        swalSuccess('Orden actualizada')
      } else {
        await upsertInstallationOrderUseCase.execute(user, areaId, draft)
        swalSuccess('Orden creada')
      }
      setModalOpen(false)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo guardar la orden',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleAssign(order: InstallationOrder, technicianId: string) {
    if (!user || busy || !canAssign) return
    const technician = technicians.find((item) => item.id === technicianId)
    setBusy(true)
    try {
      await assignInstallationOrderUseCase.execute(user, order.id, {
        technicianId: technician?.id ?? '',
        technicianName: technician?.displayName ?? '',
        scheduledDate: technician
          ? order.scheduledDate ?? new Date()
          : null,
      })
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo asignar',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleSchedule(order: InstallationOrder, value: string) {
    if (!user || busy || !canAssign) return
    const date = fromDateInput(value)
    if (!order.technicianId) {
      swalError('Asigna un técnico antes de poner la fecha')
      return
    }
    setBusy(true)
    try {
      await assignInstallationOrderUseCase.execute(user, order.id, {
        technicianId: order.technicianId,
        technicianName: order.technicianName,
        scheduledDate: date,
      })
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo guardar la fecha',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRegisteredFlag(
    order: InstallationOrder,
    flag: 'SI' | 'NO',
  ) {
    if (!user || busy || !canAssign) return
    setBusy(true)
    try {
      await updateInstallationOrderUseCase.execute(user, order.id, {
        ...draftFromInstallationOrder(order),
        registeredFlag: flag,
      })
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo guardar SI/NO',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(order: InstallationOrder) {
    if (!user) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar orden?',
      text: `Se eliminará la OT ${order.orderNumber}.`,
    })
    if (!confirmed) return
    try {
      await deleteInstallationOrderUseCase.execute(user, order.id)
      if (selectedId === order.id) setSelectedId(null)
      swalSuccess('Orden eliminada')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo eliminar',
      )
    }
  }

  async function handleImport(file: File) {
    if (!user) return
    setBusy(true)
    try {
      const parsed = parseInstallationOrdersExcel(await file.arrayBuffer())
      const result = await importInstallationOrdersUseCase.execute(
        user,
        areaId,
        parsed.rows,
      )
      swalSuccess(
        `Importadas ${result.created} nuevas y ${result.updated} actualizadas`,
      )
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo importar el Excel. Usa la plantilla.',
      )
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  function exportOrders(kind: 'pdf' | 'excel') {
    if (!user || !area) return
    const technician = technicians.find((item) => item.id === technicianFilter)
    const source = filtered.length > 0 ? filtered : orders
    try {
      const payload = {
        areaName: area.name,
        reportCode: areaReportCode(area),
        technicianName: technician?.displayName.toUpperCase() ?? 'TODOS',
        date: new Date(),
        orders: source,
      }
      const file =
        kind === 'pdf'
          ? exportInstallationOrdersToPdfUseCase.execute(user, payload)
          : exportInstallationOrdersToExcelUseCase.execute(user, payload)
      saveAs(file.blob, file.fileName)
      swalSuccess(kind === 'pdf' ? 'PDF descargado' : 'Excel descargado')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo exportar',
      )
    }
  }

  function downloadTemplate() {
    if (!user) return
    try {
      const file = exportInstallationOrdersToExcelUseCase.template(user)
      saveAs(file.blob, file.fileName)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo descargar',
      )
    }
  }

  if (!user) return null

  if (!loading && area && !isInstallationArea(area)) {
    return (
      <section className="io-page">
        <div className="page-header">
          <div>
            <p className="io-page__eyebrow">Campo</p>
            <h1>{area.name}</h1>
            <p>
              Esta actividad no usa órdenes de instalación nuevas. Si es cambio
              de medidor, ábrela desde Tareas.
            </p>
          </div>
          <Link to="/tareas" className="btn btn--soft-primary">
            Ir a Tareas
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className={`io-page${embedded ? ' io-page--embedded' : ''}`}>
      {embedded ? null : (
        <div className="page-header">
          <div>
            <p className="io-page__eyebrow">
              {mode === 'view' ? (
                <Link to="/areas">Actividades</Link>
              ) : (
                <Link to="/tareas">Tareas</Link>
              )}
            </p>
            <h1>{area?.name ?? 'Órdenes de trabajo'}</h1>
            <p>
              {mode === 'view'
                ? 'Aquí ves cómo quedó el trabajo. Para cargar el listado o asignar un técnico a cada OT, entra a Tareas.'
                : 'Aquí se asigna el trabajo de esta actividad. Cada OT tiene su técnico y su fecha. Luego se ve en Actividades.'}
            </p>
          </div>
          <div className="io-page__actions">
            {mode === 'view' ? (
              <Link
                to={`/tareas?actividad=${areaId}`}
                className="btn btn--soft-primary"
              >
                Asignar en Tareas
              </Link>
            ) : null}
            {canAssign ? (
              <>
                <button
                  type="button"
                  className="btn btn--soft-muted"
                  onClick={downloadTemplate}
                >
                  Plantilla Excel
                </button>
                <button
                  type="button"
                  className="btn btn--soft-muted"
                  onClick={() => importInputRef.current?.click()}
                  disabled={busy}
                >
                  Importar listado
                </button>
              </>
            ) : null}
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn--soft-muted"
                  onClick={() => exportOrders('excel')}
                  disabled={orders.length === 0}
                >
                  Excel
                </button>
                <button
                  type="button"
                  className="btn btn--soft-muted"
                  onClick={() => exportOrders('pdf')}
                  disabled={orders.length === 0}
                >
                  PDF
                </button>
              </>
            ) : null}
            {canAssign ? (
              <>
                <button
                  type="button"
                  className="btn btn--soft-primary"
                  onClick={openCreate}
                  disabled={busy}
                >
                  <IconPlus />
                  Nueva OT
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleImport(file)
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      )}

      {embedded && canAssign ? (
        <div className="io-page__actions io-page__actions--embedded">
          <button
            type="button"
            className="btn btn--soft-muted btn--small"
            onClick={downloadTemplate}
          >
            Plantilla
          </button>
          <button
            type="button"
            className="btn btn--soft-muted btn--small"
            onClick={() => importInputRef.current?.click()}
            disabled={busy}
          >
            Importar listado
          </button>
          <button
            type="button"
            className="btn btn--soft-muted btn--small"
            onClick={() => exportOrders('pdf')}
            disabled={orders.length === 0}
          >
            PDF
          </button>
          <button
            type="button"
            className="btn btn--soft-primary btn--small"
            onClick={openCreate}
            disabled={busy}
          >
            <IconPlus />
            Nueva OT
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
            }}
          />
        </div>
      ) : null}

      <div className="io-summary">
        <div>
          <strong>{orders.length}</strong>
          <span>órdenes</span>
        </div>
        <div>
          <strong>{programmedCount}</strong>
          <span>programadas</span>
        </div>
        <div>
          <strong>{orders.length - programmedCount}</strong>
          <span>sin asignar</span>
        </div>
        <div>
          <strong>{filtered.length}</strong>
          <span>visibles</span>
        </div>
      </div>

      <div className="io-toolbar">
        <label className="io-search">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="OT, solicitante, suministro, ruta vecino…"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
        >
          <option value="all">Todos los estados</option>
          <option value="PROGRAMADO">Programado</option>
          <option value="NO_REGISTRADO">No registrado</option>
        </select>
        <TechnicianSearchSelect
          compact
          technicians={technicians}
          valueId={technicianFilter}
          emptyLabel="Todos los técnicos"
          placeholder="Buscar técnico…"
          onChange={(technician) => setTechnicianFilter(technician?.id ?? '')}
        />
      </div>

      <div className={`io-layout ${selected ? 'io-layout--split' : ''}`}>
        <div className="io-table-wrap">
          {loading ? (
            <p className="io-empty">Cargando órdenes…</p>
          ) : filtered.length === 0 ? (
            <div className="io-empty">
              <h2>Sin órdenes</h2>
              <p>
                {canAssign
                  ? 'Importa el listado o crea la OT con Nueva tarea.'
                  : mode === 'view'
                    ? 'Aún no hay órdenes. Se cargan y asignan en Tareas.'
                    : 'Aún no tienes órdenes asignadas en esta actividad.'}
              </p>
            </div>
          ) : (
            <table className="io-table">
              <thead>
                <tr>
                  <th>OT</th>
                  <th>SI/NO</th>
                  <th>Cat.</th>
                  <th>Referencia</th>
                  <th>Registro</th>
                  <th>Tipo</th>
                  <th>Cl.</th>
                  <th>Solicitante</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th>Fecha prog.</th>
                  <th>Técnico</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className={
                      order.id === selectedId
                        ? 'is-selected'
                        : order.status === 'PROGRAMADO'
                          ? 'is-programmed'
                          : ''
                    }
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td>
                      <strong className="io-ot">{order.orderNumber}</strong>
                    </td>
                    <td>
                      {canAssign ? (
                        <RegisteredFlagPicker
                          compact
                          value={order.registeredFlag}
                          disabled={busy}
                          onChange={(flag) =>
                            void handleRegisteredFlag(
                              order,
                              flag === 'SI' ? 'SI' : 'NO',
                            )
                          }
                        />
                      ) : (
                        installationRegisteredFlag(order.registeredFlag)
                      )}
                    </td>
                    <td>{order.categoryCode}</td>
                    <td>{order.referenceNumber || order.neighborRouteCode}</td>
                    <td className="io-date">
                      {formatInstallationDateTime(order.recordedAt)}
                    </td>
                    <td>{order.typeInitials}</td>
                    <td>{order.classification}</td>
                    <td>{order.applicantName}</td>
                    <td>{order.applicantAddress}</td>
                    <td>
                      <StatusBadge order={order} />
                    </td>
                    <td className="io-date">
                      {canAssign ? (
                        <input
                          type="date"
                          value={toDateInput(order.scheduledDate)}
                          disabled={!order.technicianId || busy}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            void handleSchedule(order, event.target.value)
                          }
                        />
                      ) : (
                        formatInstallationDate(order.scheduledDate)
                      )}
                    </td>
                    <td>
                      {canAssign ? (
                        <div
                          className="io-tech-select"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <TechnicianSearchSelect
                            compact
                            technicians={technicians}
                            valueId={order.technicianId}
                            disabled={busy}
                            placeholder="Buscar técnico…"
                            emptyLabel="Sin asignar"
                            onChange={(technician) =>
                              void handleAssign(order, technician?.id ?? '')
                            }
                          />
                        </div>
                      ) : (
                        <span className="io-tech">
                          <IconPeople />
                          {order.technicianName || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected ? (
          <aside className="io-detail">
            <header className="io-detail__head">
              <h2>{selected.orderNumber}</h2>
              <button
                type="button"
                className="btn btn--icon-only btn--soft-muted"
                onClick={() => setSelectedId(null)}
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </header>
            <DetailField label="SUB TIPO">
              {installationMeterTypeLabel(selected.subType)}
            </DetailField>
            <DetailField label="SOLICITANTE">
              {selected.applicantName || '—'}
            </DetailField>
            <DetailField label="DIRECCION SOLICITANTE">
              {selected.applicantAddress || '—'}
            </DetailField>
            <DetailField label="SMDD" icon={<IconBuilding />}>
              <span className="io-detail__sector">
                {selected.sectorCijp || '—'}
              </span>
            </DetailField>
            <DetailField label="SECTOR" icon={<IconBuilding />}>
              <span className="io-detail__sector">{selected.sector || '—'}</span>
            </DetailField>
            <DetailField label="SUMINISTRO">
              {selected.supplyCode || '—'}
            </DetailField>
            <DetailField label="COD RUTA VECINO CIJP">
              {selected.neighborRouteCode || '—'}
            </DetailField>
            <DetailField label="CENTRO_ATENCION">
              {selected.attentionCenter || '—'}
            </DetailField>
            <DetailField label="SI/NO">
              {installationRegisteredFlag(selected.registeredFlag)}
            </DetailField>
            <DetailField label="ESTADO OT CIJP">
              <StatusBadge order={selected} />
            </DetailField>
            <DetailField label="OBS DE EJEC">
              {selected.executionNotes || ' '}
            </DetailField>
            <DetailField label="TECNICO1 CIJP" icon={<IconPeople />}>
              <span className="io-detail__tech">
                {selected.technicianName || '—'}
              </span>
            </DetailField>
            <DetailField label="FECHA PROG CIJP">
              <span className="io-detail__date">
                {formatInstallationDate(selected.scheduledDate) || '—'}
              </span>
            </DetailField>
            {canAssign ? (
              <div className="io-detail__actions">
                <button
                  type="button"
                  className="btn btn--soft-blue"
                  onClick={() => openEdit(selected)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--soft-rose"
                  onClick={() => void handleDelete(selected)}
                >
                  Eliminar
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      <AppModal
        open={modalOpen}
        title={editing ? `Editar OT ${editing.orderNumber}` : 'Nueva orden de trabajo'}
        description="Una OT se asigna independiente: técnico y fecha propios."
        size="md"
        onClose={() => !busy && setModalOpen(false)}
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
              form="io-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="io-form" onSubmit={(event) => void handleSave(event)}>
          <div className="io-form">
            <label className="field">
              <span>Número de OT</span>
              <input
                value={draft.orderNumber}
                onChange={(event) => patchDraft({ orderNumber: event.target.value })}
                placeholder="2025200002000217590"
                required
                disabled={Boolean(editing)}
              />
            </label>
            <div className="io-form__row">
              <label className="field">
                <span>Tipo de medidor</span>
                <select
                  value={installationMeterTypeFromSubType(draft.subType)}
                  onChange={(event) =>
                    patchDraft({
                      subType: installationSubTypeFromMeterType(
                        event.target.value as InstallationMeterType,
                      ),
                    })
                  }
                >
                  {INSTALLATION_METER_TYPE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.shortLabel} — {option.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Suministro</span>
                <input
                  value={draft.supplyCode}
                  onChange={(event) => patchDraft({ supplyCode: event.target.value })}
                  placeholder="12000060091"
                />
              </label>
            </div>
            <label className="field">
              <span>Solicitante</span>
              <input
                value={draft.applicantName}
                onChange={(event) =>
                  patchDraft({ applicantName: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Dirección del solicitante</span>
              <input
                value={draft.applicantAddress}
                onChange={(event) =>
                  patchDraft({ applicantAddress: event.target.value })
                }
              />
            </label>
            <div className="io-form__row">
              <label className="field">
                <span>SMDD</span>
                <input
                  value={draft.sectorCijp}
                  onChange={(event) => {
                    const sectorCijp = event.target.value
                    patchDraft({
                      sectorCijp,
                      sector: draft.sector || sectorCijp,
                      attentionCenter: draft.attentionCenter || sectorCijp,
                    })
                  }}
                  placeholder="MALDONADO"
                />
              </label>
              <label className="field">
                <span>Sector</span>
                <input
                  value={draft.sector}
                  onChange={(event) => patchDraft({ sector: event.target.value })}
                  placeholder="MALDONADO"
                />
              </label>
            </div>
            <label className="field">
              <span>Centro de atención</span>
              <input
                value={draft.attentionCenter}
                onChange={(event) =>
                  patchDraft({ attentionCenter: event.target.value })
                }
                placeholder="MALDONADO"
              />
            </label>
            <div className="field">
              <span>Ruta vecino (búscala en rutas de suministro)</span>
              <SupplyCatalogSearch
                value={draft.neighborRouteCode}
                onChange={(code) => patchDraft({ neighborRouteCode: code })}
                placeholder="Buscar código de suministro vecino…"
                hint="Escribe 3 dígitos o más. Es el mismo catálogo de rutas de suministro."
              />
            </div>
            <div className="field">
              <span>Estado SI / NO</span>
              <RegisteredFlagPicker
                value={draft.registeredFlag}
                onChange={(flag) =>
                  patchDraft({ registeredFlag: flag === 'SI' ? 'SI' : 'NO' })
                }
              />
            </div>
            <div className="io-form__row">
              <div className="field">
                <span>Técnico</span>
                <TechnicianSearchSelect
                  technicians={technicians}
                  valueId={draft.technicianId}
                  placeholder="Buscar técnico…"
                  emptyLabel="Sin asignar"
                  onChange={(technician) =>
                    patchDraft({
                      technicianId: technician?.id ?? '',
                      technicianName: technician?.displayName ?? '',
                      scheduledDate: technician
                        ? draft.scheduledDate ?? new Date()
                        : null,
                    })
                  }
                />
              </div>
              <label className="field">
                <span>Fecha programada</span>
                <input
                  type="date"
                  value={toDateInput(draft.scheduledDate)}
                  onChange={(event) =>
                    patchDraft({ scheduledDate: fromDateInput(event.target.value) })
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Observación de ejecución</span>
              <textarea
                rows={2}
                value={draft.executionNotes}
                onChange={(event) =>
                  patchDraft({ executionNotes: event.target.value })
                }
              />
            </label>
          </div>
        </form>
      </AppModal>
    </section>
  )
}
