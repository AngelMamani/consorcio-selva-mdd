import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { saveAs } from 'file-saver'
import type { Area } from '@/domain/entities/Area'
import { areaReportCode, isMeterChangeArea } from '@/domain/entities/Area'
import type {
  MeterChangeOrder,
  MeterChangeOrderDraft,
} from '@/domain/entities/MeterChangeOrder'
import {
  draftFromMeterChangeOrder,
  emptyMeterChangeOrderDraft,
  formatMeterChangeDate,
  formatMeterChangeLocation,
  meterChangeDoneFlag,
  meterChangeDoneFlagClass,
  meterChangeDoneFlagLabel,
  meterChangeOrderStatusLabel,
  meterChangeSystemFromValue,
  meterChangeSystemLabel,
  METER_CHANGE_SYSTEM_OPTIONS,
  parseMeterChangeLocation,
  buildMeterChangePedido,
} from '@/domain/entities/MeterChangeOrder'
import type { User } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { parseMeterChangeOrdersExcel } from '@/infrastructure/excel/parseMeterChangeOrdersExcel'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import { RegisteredFlagPicker } from '@/presentation/components/RegisteredFlagPicker'
import { SupplyCatalogSearch } from '@/presentation/components/SupplyCatalogSearch'
import { TechnicianSearchSelect } from '@/presentation/components/TechnicianSearchSelect'
import { supplyHasLocation } from '@/domain/entities/Supply'
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

export function MeterChangeOrdersBoard({
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
    listMeterChangeOrdersUseCase,
    upsertMeterChangeOrderUseCase,
    updateMeterChangeOrderUseCase,
    assignMeterChangeOrderUseCase,
    deleteMeterChangeOrderUseCase,
    importMeterChangeOrdersUseCase,
    exportMeterChangeOrdersToPdfUseCase,
    exportMeterChangeOrdersToExcelUseCase,
  } = useDependencies()

  const isAdmin = Boolean(user && canManageUsers(user.role))
  const canAssign = isAdmin && mode === 'assign'

  const [area, setArea] = useState<Area | null>(null)
  const [technicians, setTechnicians] = useState<User[]>([])
  const [orders, setOrders] = useState<MeterChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MeterChangeOrder | null>(null)
  const [draft, setDraft] = useState<MeterChangeOrderDraft>(
    emptyMeterChangeOrderDraft(),
  )
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!user) return
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
        stop = listMeterChangeOrdersUseCase.watch(
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
            : 'No se pudieron cargar los cambios de medidor',
        )
      }
    })()
    return () => stop()
  }, [
    user,
    areaId,
    getAreaUseCase,
    listTechniciansUseCase,
    listMeterChangeOrdersUseCase,
  ])

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (technicianFilter && order.technicianId !== technicianFilter) {
        return false
      }
      if (!query) return true
      const haystack = [
        order.orderNumber,
        order.pedido,
        order.customerName,
        order.address,
        order.supplyCode,
        order.routeCode,
        order.meterSerial,
        order.technicianName,
        order.systemType,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [orders, deferredSearch, statusFilter, technicianFilter])

  const programmedCount = orders.filter(
    (item) => item.status === 'PROGRAMADO',
  ).length
  const selected = orders.find((item) => item.id === selectedId) ?? null

  function openCreate() {
    setEditing(null)
    setDraft(emptyMeterChangeOrderDraft())
    setModalOpen(true)
  }

  function openEdit(order: MeterChangeOrder) {
    setEditing(order)
    setDraft(draftFromMeterChangeOrder(order))
    setModalOpen(true)
  }

  function patchDraft(partial: Partial<MeterChangeOrderDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || busy || !canAssign) return
    setBusy(true)
    try {
      if (editing) {
        await updateMeterChangeOrderUseCase.execute(user, editing.id, draft)
        swalSuccess('Orden actualizada')
      } else {
        await upsertMeterChangeOrderUseCase.execute(user, areaId, draft)
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

  async function handleAssign(order: MeterChangeOrder, technicianId: string) {
    if (!user || rowBusyId || !canAssign) return
    const technician = technicians.find((item) => item.id === technicianId)
    setRowBusyId(order.id)
    try {
      await assignMeterChangeOrderUseCase.execute(user, order.id, {
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
      setRowBusyId(null)
    }
  }

  async function handleSchedule(order: MeterChangeOrder, value: string) {
    if (!user || rowBusyId || !canAssign) return
    if (!order.technicianId) {
      swalError('Asigna un técnico antes de poner la fecha')
      return
    }
    setRowBusyId(order.id)
    try {
      await assignMeterChangeOrderUseCase.execute(user, order.id, {
        technicianId: order.technicianId,
        technicianName: order.technicianName,
        scheduledDate: fromDateInput(value),
      })
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo guardar la fecha',
      )
    } finally {
      setRowBusyId(null)
    }
  }

  async function handleChangeDone(
    order: MeterChangeOrder,
    flag: 'PENDIENTE' | 'SI' | 'NO',
  ) {
    if (!user || rowBusyId === order.id || !canAssign) return
    const previous = meterChangeDoneFlag(order.changeDoneFlag)
    if (previous === flag) return

    // Optimistic UI so PENDIENTE / SI / NO se ve al instante.
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? { ...item, changeDoneFlag: flag } : item,
      ),
    )
    setRowBusyId(order.id)
    try {
      await updateMeterChangeOrderUseCase.execute(user, order.id, {
        ...draftFromMeterChangeOrder(order),
        changeDoneFlag: flag,
      })
    } catch (err) {
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? { ...item, changeDoneFlag: previous }
            : item,
        ),
      )
      const message =
        err instanceof DomainError
          ? err.message
          : err instanceof Error && /permission|insufficient/i.test(err.message)
            ? 'No se pudo guardar el estado. Despliega las reglas de Firestore (firestore:rules).'
            : 'No se pudo guardar el estado'
      swalError(message)
    } finally {
      setRowBusyId(null)
    }
  }

  async function handleDelete(order: MeterChangeOrder) {
    if (!user) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar orden?',
      text: `Se eliminará la OT ${order.orderNumber}.`,
    })
    if (!confirmed) return
    try {
      await deleteMeterChangeOrderUseCase.execute(user, order.id)
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
      const parsed = parseMeterChangeOrdersExcel(await file.arrayBuffer())
      const result = await importMeterChangeOrdersUseCase.execute(
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
          : 'No se pudo importar el Excel LISTA_CM',
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
          ? exportMeterChangeOrdersToPdfUseCase.execute(user, payload)
          : exportMeterChangeOrdersToExcelUseCase.execute(user, payload)
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
      const file = exportMeterChangeOrdersToExcelUseCase.template(user)
      saveAs(file.blob, file.fileName)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo descargar',
      )
    }
  }

  if (!user) return null

  if (!loading && area && !isMeterChangeArea(area)) {
    return (
      <section className="io-page">
        <div className="page-header">
          <div>
            <h1>{area.name}</h1>
            <p>
              Esta actividad no es de cambio de medidor. Crea una actividad
              llamada «Cambio de medidor» (órdenes de trabajo, código CM).
            </p>
          </div>
          <Link to="/areas" className="btn btn--soft-primary">
            Ir a Actividades
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
              <Link to="/tareas">Tareas</Link>
            </p>
            <h1>{area?.name ?? 'Cambio de medidor'}</h1>
            <p>
              Importa el Excel LISTA_CM o crea OTs una por una. Cada OT tiene
              técnico, fecha, serie de medidor y sistema C1/C2.
            </p>
          </div>
          <div className="io-page__actions">
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
                  Importar LISTA_CM
                </button>
                <button
                  type="button"
                  className="btn btn--soft-primary"
                  onClick={openCreate}
                  disabled={busy}
                >
                  Nueva OT
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleImport(file)
                  }}
                />
              </>
            ) : null}
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn--soft-muted"
                  onClick={() => exportOrders('pdf')}
                  disabled={orders.length === 0}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className="btn btn--soft-muted"
                  onClick={() => exportOrders('excel')}
                  disabled={orders.length === 0}
                >
                  Excel
                </button>
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
            Importar LISTA_CM
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
            className="btn btn--soft-muted btn--small"
            onClick={() => exportOrders('excel')}
            disabled={orders.length === 0}
          >
            Excel
          </button>
          <button
            type="button"
            className="btn btn--soft-primary btn--small"
            onClick={openCreate}
            disabled={busy}
          >
            Nueva OT
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
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
          <span>sin registrar</span>
        </div>
      </div>

      <div className="io-toolbar">
        <input
          className="io-toolbar__search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar OT, cliente, suministro, serie…"
        />
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
        >
          <option value="all">Todos</option>
          <option value="PROGRAMADO">Programado</option>
          <option value="NO_REGISTRADO">No registrado</option>
        </select>
        <TechnicianSearchSelect
          compact
          technicians={technicians}
          valueId={technicianFilter}
          emptyLabel="Todos los técnicos"
          placeholder="Filtrar técnico…"
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
                {orders.length === 0
                  ? 'Importa el Excel LISTA_CM o crea una nueva OT.'
                  : 'Sin resultados con estos filtros.'}
              </p>
            </div>
          ) : (
            <table className="io-table">
              <thead>
                <tr>
                  <th>OT</th>
                  <th>Estado</th>
                  <th>Cliente</th>
                  <th>Suministro</th>
                  <th>Serie</th>
                  <th>Sistema</th>
                  <th>Asignación</th>
                  <th>Fecha prog.</th>
                  <th>Técnico</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const done = meterChangeDoneFlag(order.changeDoneFlag)
                  const rowBusy = rowBusyId === order.id
                  return (
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
                      <td
                        className="io-estado-cell"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {canAssign ? (
                          <RegisteredFlagPicker
                            withPending
                            compact
                            value={done}
                            disabled={rowBusy}
                            onChange={(flag) =>
                              void handleChangeDone(order, flag)
                            }
                          />
                        ) : (
                          <span className={meterChangeDoneFlagClass(done)}>
                            {meterChangeDoneFlagLabel(done)}
                          </span>
                        )}
                      </td>
                      <td>{order.customerName || '—'}</td>
                      <td>{order.supplyCode || '—'}</td>
                      <td>{order.meterSerial || '—'}</td>
                      <td>{meterChangeSystemLabel(order.systemType)}</td>
                      <td>
                        <span
                          className={`io-status ${
                            order.status === 'PROGRAMADO'
                              ? 'io-status--on'
                              : 'io-status--off'
                          }`}
                        >
                          {meterChangeOrderStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="io-date">
                        {canAssign ? (
                          <input
                            type="date"
                            value={toDateInput(order.scheduledDate)}
                            disabled={!order.technicianId || rowBusy}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              void handleSchedule(order, event.target.value)
                            }
                          />
                        ) : (
                          formatMeterChangeDate(order.scheduledDate) || '—'
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
                              valueLabel={order.technicianName}
                              disabled={rowBusy}
                              placeholder="Asignar técnico…"
                              emptyLabel="Sin asignar"
                              onChange={(technician) =>
                                void handleAssign(order, technician?.id ?? '')
                              }
                            />
                          </div>
                        ) : (
                          <span className="io-tech">
                            {order.technicianName || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
            <p>
              <small>PEDIDO</small>
              <br />
              {selected.pedido || '—'}
            </p>
            <p>
              <small>ESTADO</small>
              <br />
              {canAssign ? (
                <RegisteredFlagPicker
                  withPending
                  value={meterChangeDoneFlag(selected.changeDoneFlag)}
                  disabled={rowBusyId === selected.id}
                  onChange={(flag) => void handleChangeDone(selected, flag)}
                />
              ) : (
                <span
                  className={meterChangeDoneFlagClass(
                    meterChangeDoneFlag(selected.changeDoneFlag),
                  )}
                >
                  {meterChangeDoneFlagLabel(
                    meterChangeDoneFlag(selected.changeDoneFlag),
                  )}
                </span>
              )}
            </p>
            <p>
              <small>CLIENTE</small>
              <br />
              {selected.customerName || '—'}
            </p>
            <p>
              <small>DIRECCIÓN</small>
              <br />
              {selected.address || '—'}
            </p>
            <p>
              <small>SUMINISTRO / RUTA</small>
              <br />
              {selected.supplyCode || '—'} / {selected.routeCode || '—'}
            </p>
            <p>
              <small>SERIE DE MEDIDOR</small>
              <br />
              {selected.meterSerial || '—'}
            </p>
            <p>
              <small>SISTEMA</small>
              <br />
              {meterChangeSystemLabel(selected.systemType)}
            </p>
            <p>
              <small>TÉCNICO</small>
              <br />
              {selected.technicianName || 'Sin asignar'}
            </p>
            <p>
              <small>FECHA PROGRAMADA</small>
              <br />
              {formatMeterChangeDate(selected.scheduledDate) || '—'}
            </p>
            <p>
              <small>UBICACIÓN</small>
              <br />
              {formatMeterChangeLocation(
                selected.latitude,
                selected.longitude,
              ) || '—'}
            </p>
            <p>
              <small>OBSERVACIONES</small>
              <br />
              {selected.observations || '—'}
            </p>
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
        title={
          editing
            ? `Editar OT ${editing.orderNumber}`
            : 'Nueva orden — cambio de medidor'
        }
        description="Misma estructura del Excel LISTA_CM."
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
              form="cm-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="cm-form" onSubmit={(event) => void handleSave(event)}>
          <div className="io-form">
            <label className="field">
              <span>Número de OT</span>
              <input
                value={draft.orderNumber}
                onChange={(event) =>
                  patchDraft({ orderNumber: event.target.value })
                }
                required
                disabled={Boolean(editing)}
              />
            </label>
            <label className="field">
              <span>Pedido (técnico + CM + fecha)</span>
              <input
                value={buildMeterChangePedido({
                  technicianName: draft.technicianName,
                  typeCode: 'CM',
                  scheduledDate: draft.scheduledDate,
                })}
                readOnly
                placeholder="Se arma al elegir técnico y fecha"
                title="Concatenación automática: TECNICO_CM_DD-MM-AAAA"
              />
            </label>
            <div className="io-form__row">
              <label className="field">
                <span>Sistema (medidor)</span>
                <select
                  value={meterChangeSystemFromValue(draft.systemType)}
                  onChange={(event) =>
                    patchDraft({
                      systemType: event.target.value,
                      typeCode: 'CM',
                    })
                  }
                >
                  {METER_CHANGE_SYSTEM_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.shortLabel} — {option.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tipo</span>
                <input value="CM — Cambio de medidor" readOnly title="Tipo fijo: CM" />
              </label>
            </div>
            <label className="field">
              <span>Nombre del cliente</span>
              <input
                value={draft.customerName}
                onChange={(event) =>
                  patchDraft({ customerName: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Dirección</span>
              <input
                value={draft.address}
                onChange={(event) => patchDraft({ address: event.target.value })}
              />
            </label>
            <div className="field">
              <span>Suministro (búscale en el catálogo)</span>
              <SupplyCatalogSearch
                value={draft.supplyCode}
                onChange={(code) =>
                  patchDraft({
                    supplyCode: code,
                    routeCode: draft.routeCode || code,
                    typeCode: 'CM',
                    ...(code ? {} : { latitude: null, longitude: null }),
                  })
                }
                onPickSupply={(supply) => {
                  if (!supply) {
                    patchDraft({ latitude: null, longitude: null })
                    return
                  }
                  patchDraft({
                    supplyCode: supply.routeCode,
                    routeCode: draft.routeCode || supply.routeCode,
                    typeCode: 'CM',
                    latitude: supplyHasLocation(supply)
                      ? supply.latitude
                      : draft.latitude,
                    longitude: supplyHasLocation(supply)
                      ? supply.longitude
                      : draft.longitude,
                  })
                }}
                placeholder="Escribe 3+ dígitos del suministro…"
                hint="Busca en el catálogo. Si tiene GPS, se carga la ubicación."
                pickedCaption="Suministro del catálogo"
                minCodeLength={7}
                maxCodeLength={15}
              />
            </div>
            <label className="field">
              <span>Código de ruta</span>
              <input
                value={draft.routeCode}
                onChange={(event) =>
                  patchDraft({ routeCode: event.target.value })
                }
                placeholder="Se completa al elegir suministro (o edítalo)"
              />
            </label>
            <label className="field">
              <span>Serie de medidor</span>
              <input
                value={draft.meterSerial}
                onChange={(event) =>
                  patchDraft({ meterSerial: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Ubicación (GPS del suministro)</span>
              <input
                value={formatMeterChangeLocation(draft.latitude, draft.longitude)}
                onChange={(event) => {
                  const next = parseMeterChangeLocation(event.target.value)
                  patchDraft({
                    latitude: next.latitude,
                    longitude: next.longitude,
                  })
                }}
                placeholder="Se completa al buscar el suministro"
              />
            </label>
            <div className="field">
              <span>Estado (PENDIENTE / SI / NO)</span>
              <RegisteredFlagPicker
                withPending
                value={meterChangeDoneFlag(draft.changeDoneFlag)}
                onChange={(flag) => patchDraft({ changeDoneFlag: flag })}
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
                  onChange={(technician) => {
                    const scheduledDate = technician
                      ? draft.scheduledDate ?? new Date()
                      : null
                    const technicianName = technician?.displayName ?? ''
                    patchDraft({
                      technicianId: technician?.id ?? '',
                      technicianName,
                      scheduledDate,
                      typeCode: 'CM',
                      pedido: buildMeterChangePedido({
                        technicianName,
                        typeCode: 'CM',
                        scheduledDate,
                      }),
                    })
                  }}
                />
              </div>
              <label className="field">
                <span>Fecha programada</span>
                <input
                  type="date"
                  value={toDateInput(draft.scheduledDate)}
                  onChange={(event) => {
                    const scheduledDate = fromDateInput(event.target.value)
                    patchDraft({
                      scheduledDate,
                      typeCode: 'CM',
                      pedido: buildMeterChangePedido({
                        technicianName: draft.technicianName,
                        typeCode: 'CM',
                        scheduledDate,
                      }),
                    })
                  }}
                />
              </label>
            </div>
            <label className="field">
              <span>Observaciones</span>
              <textarea
                rows={2}
                value={draft.observations}
                onChange={(event) =>
                  patchDraft({ observations: event.target.value })
                }
              />
            </label>
          </div>
        </form>
      </AppModal>
    </section>
  )
}
