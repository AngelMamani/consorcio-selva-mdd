import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Area } from '@/domain/entities/Area'
import type { Task } from '@/domain/entities/Task'
import {
  formatTaskAssignees,
  TaskStatus,
  taskHasMapPoint,
  taskStatusLabel,
} from '@/domain/entities/Task'
import type { User } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './FoldersPage.css'
import './TasksPage.css'

type TaskMapPoint = {
  task: Task
  latitude: number
  longitude: number
}

const DEFAULT_CENTER: L.LatLngExpression = [-12.5933, -69.1891]

function statusPinClass(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.Completada:
      return 'tasks-pin__dot--done'
    case TaskStatus.EnProgreso:
      return 'tasks-pin__dot--progress'
    default:
      return 'tasks-pin__dot--pending'
  }
}

function openSupplyMaps(lat: number, lng: number): void {
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    '_blank',
    'noopener,noreferrer',
  )
}

type StatusFilter = 'all' | TaskStatus

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

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
      />
    </svg>
  )
}

function formatDate(date: Date | null): string {
  if (!date) return 'Sin fecha'
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function toDateInputValue(date: Date | null): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateInputValue(value: string): Date | null {
  if (!value.trim()) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function TaskAssigneePicker({
  assignToAllTechnicians,
  assignedTechnicianIds,
  technicians,
  onAssignAll,
  onAssignSpecific,
  onToggleTechnician,
}: {
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  technicians: User[]
  onAssignAll: () => void
  onAssignSpecific: () => void
  onToggleTechnician: (id: string) => void
}) {
  const [techSearch, setTechSearch] = useState('')
  const deferred = useDeferredValue(techSearch)
  const filtered = useMemo(() => {
    const term = deferred.trim().toLowerCase()
    if (!term) return technicians
    return technicians.filter((tech) =>
      tech.displayName.toLowerCase().includes(term),
    )
  }, [technicians, deferred])

  return (
    <div className="folder-assignees">
      <div className="folder-assignees__head">
        <div>
          <p className="folder-assignees__label">Asignar a</p>
          <p className="folder-assignees__hint">
            Quién verá y podrá completar esta tarea
          </p>
        </div>
        <span className="folder-assignees__count">
          {assignToAllTechnicians
            ? 'Todos'
            : `${assignedTechnicianIds.length} seleccionado${assignedTechnicianIds.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="folder-assignees__modes" role="radiogroup" aria-label="Modo">
        <button
          type="button"
          className={`folder-assignees__mode ${assignToAllTechnicians ? 'is-active' : ''}`}
          aria-pressed={assignToAllTechnicians}
          onClick={onAssignAll}
        >
          <span className="folder-assignees__mode-icon" aria-hidden="true">
            <IconPeople />
          </span>
          <span className="folder-assignees__mode-copy">
            <strong>Todos los técnicos</strong>
            <small>Visible para el equipo completo</small>
          </span>
          <span className="folder-assignees__mode-check" aria-hidden="true">
            <IconCheck />
          </span>
        </button>
        <button
          type="button"
          className={`folder-assignees__mode ${!assignToAllTechnicians ? 'is-active' : ''}`}
          aria-pressed={!assignToAllTechnicians}
          onClick={onAssignSpecific}
        >
          <span className="folder-assignees__mode-icon" aria-hidden="true">
            <IconPeople />
          </span>
          <span className="folder-assignees__mode-copy">
            <strong>Técnicos específicos</strong>
            <small>Elige uno o más</small>
          </span>
          <span className="folder-assignees__mode-check" aria-hidden="true">
            <IconCheck />
          </span>
        </button>
      </div>

      {!assignToAllTechnicians ? (
        <div className="folder-assignees__picker">
          <label className="folder-assignees__search">
            <span className="sr-only">Buscar técnico</span>
            <input
              type="search"
              value={techSearch}
              onChange={(event) => setTechSearch(event.target.value)}
              placeholder="Buscar técnico…"
            />
          </label>
          {filtered.length === 0 ? (
            <p className="folder-assignees__empty">No hay técnicos para mostrar</p>
          ) : (
            <div className="folder-assignees__grid" role="group" aria-label="Técnicos">
              {filtered.map((tech) => {
                const selected = assignedTechnicianIds.includes(tech.id)
                return (
                  <button
                    key={tech.id}
                    type="button"
                    className={`folder-assignees__tech ${selected ? 'is-selected' : ''}`}
                    onClick={() => onToggleTechnician(tech.id)}
                  >
                    <span className="folder-assignees__tech-copy">
                      <strong>{tech.displayName}</strong>
                    </span>
                    {selected ? (
                      <span className="folder-assignees__tech-check" aria-hidden="true">
                        <IconCheck />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function TasksPage() {
  const { user } = useAuth()
  const {
    listTasksUseCase,
    createTaskUseCase,
    updateTaskUseCase,
    completeTaskUseCase,
    startTaskUseCase,
    deleteTaskUseCase,
    listTechniciansUseCase,
    listAreasUseCase,
    getSupplyByRouteCodeUseCase,
  } = useDependencies()

  const isAdmin = Boolean(user && canManageUsers(user.role))
  const [tasks, setTasks] = useState<Task[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [mapPoints, setMapPoints] = useState<TaskMapPoint[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [areaId, setAreaId] = useState('')
  const [routeCode, setRouteCode] = useState('')
  const [assignToAll, setAssignToAll] = useState(false)
  const [assignedIds, setAssignedIds] = useState<string[]>([])

  const filteredTasks = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === 'all' || task.status === statusFilter
      if (!matchesStatus) return false
      if (!query) return true
      const haystack =
        `${task.title} ${task.description} ${task.areaName} ${task.routeCode} ${formatTaskAssignees(task)}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [tasks, deferredSearch, statusFilter])

  const filteredMapPoints = useMemo(() => {
    const ids = new Set(filteredTasks.map((task) => task.id))
    return mapPoints.filter((point) => ids.has(point.task.id))
  }, [filteredTasks, mapPoints])

  const pointByTaskId = useMemo(() => {
    const map = new Map<string, TaskMapPoint>()
    for (const point of mapPoints) map.set(point.task.id, point)
    return map
  }, [mapPoints])

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      pendiente: tasks.filter((task) => task.status === TaskStatus.Pendiente)
        .length,
      progreso: tasks.filter((task) => task.status === TaskStatus.EnProgreso)
        .length,
      hecha: tasks.filter((task) => task.status === TaskStatus.Completada)
        .length,
    }
  }, [tasks])

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const [nextTasks, nextAreas, nextTechs] = await Promise.all([
        listTasksUseCase.execute(user),
        listAreasUseCase.execute(user),
        listTechniciansUseCase.execute(user),
      ])
      setTasks(nextTasks)
      setAreas(nextAreas)
      setTechnicians(nextTechs)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudieron cargar las tareas',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setMapPoints([])
      return
    }

    let cancelled = false

    async function resolvePoints() {
      const points: TaskMapPoint[] = []
      const missingCodes = new Map<string, Task[]>()

      for (const task of tasks) {
        if (taskHasMapPoint(task)) {
          points.push({
            task,
            latitude: task.latitude!,
            longitude: task.longitude!,
          })
          continue
        }
        const code = task.routeCode.trim()
        if (!code) continue
        const bucket = missingCodes.get(code) ?? []
        bucket.push(task)
        missingCodes.set(code, bucket)
      }

      await Promise.all(
        [...missingCodes.entries()].map(async ([code, linked]) => {
          try {
            const supply = await getSupplyByRouteCodeUseCase.execute(user!, code)
            if (!supply || cancelled) return
            for (const task of linked) {
              points.push({
                task,
                latitude: supply.latitude,
                longitude: supply.longitude,
              })
            }
          } catch {
            // Sin catálogo para ese código: se omite del mapa.
          }
        }),
      )

      if (cancelled) return
      setMapPoints(points)
    }

    void resolvePoints()
    return () => {
      cancelled = true
    }
  }, [tasks, user, getSupplyByRouteCodeUseCase])

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el || mapRef.current) return

    const map = L.map(el, {
      center: DEFAULT_CENTER,
      zoom: 12,
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    markersLayerRef.current = L.layerGroup().addTo(map)

    const enableWheel = () => map.scrollWheelZoom.enable()
    const disableWheel = () => map.scrollWheelZoom.disable()
    map.on('click', enableWheel)
    el.addEventListener('mouseleave', disableWheel)

    const refresh = () => map.invalidateSize({ animate: false })
    const resizeObserver = new ResizeObserver(refresh)
    resizeObserver.observe(el)
    window.addEventListener('resize', refresh)
    window.setTimeout(refresh, 80)
    window.setTimeout(refresh, 320)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', refresh)
      map.off('click', enableWheel)
      el.removeEventListener('mouseleave', disableWheel)
      map.remove()
      mapRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = markersLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    if (filteredMapPoints.length === 0) {
      map.setView(DEFAULT_CENTER, 12)
      window.setTimeout(() => map.invalidateSize({ animate: false }), 50)
      return
    }

    const bounds = L.latLngBounds([])
    for (const point of filteredMapPoints) {
      const selected = point.task.id === selectedTaskId
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: 'tasks-pin',
          html: `<span class="tasks-pin__dot ${statusPinClass(point.task.status)}${selected ? ' is-selected' : ''}"></span><span class="tasks-pin__code">${point.task.routeCode}</span>`,
          iconSize: [96, 36],
          iconAnchor: [16, 30],
        }),
        zIndexOffset: selected ? 900 : 400,
      })
      marker.bindPopup(
        `<strong>${point.task.title}</strong><br/>Suministro ${point.task.routeCode}<br/><small>${taskStatusLabel(point.task.status)}</small>`,
      )
      marker.on('click', () => setSelectedTaskId(point.task.id))
      marker.addTo(layer)
      bounds.extend([point.latitude, point.longitude])
    }

    const selected = filteredMapPoints.find(
      (point) => point.task.id === selectedTaskId,
    )
    if (selected) {
      map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 15))
    } else if (filteredMapPoints.length === 1) {
      map.setView(
        [filteredMapPoints[0].latitude, filteredMapPoints[0].longitude],
        15,
      )
    } else {
      map.fitBounds(bounds.pad(0.18), { maxZoom: 16 })
    }
    window.setTimeout(() => map.invalidateSize({ animate: false }), 50)
  }, [filteredMapPoints, selectedTaskId])

  function openCreate() {
    setEditing(null)
    setTitle('')
    setDescription('')
    setDueDate('')
    setAreaId('')
    setRouteCode('')
    setAssignToAll(false)
    setAssignedIds([])
    setModalOpen(true)
  }

  function openEdit(task: Task) {
    setEditing(task)
    setTitle(task.title)
    setDescription(task.description)
    setDueDate(toDateInputValue(task.dueDate))
    setAreaId(task.areaId)
    setRouteCode(task.routeCode)
    setAssignToAll(task.assignToAllTechnicians)
    setAssignedIds([...task.assignedTechnicianIds])
    setModalOpen(true)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || busy) return
    setBusy(true)
    try {
      if (editing) {
        const updated = await updateTaskUseCase.execute(user, editing.id, {
          title,
          description,
          dueDate: fromDateInputValue(dueDate),
          areaId,
          routeCode,
          assignToAllTechnicians: assignToAll,
          assignedTechnicianIds: assignedIds,
        })
        setTasks((current) =>
          current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
        )
        swalSuccess('Tarea actualizada')
      } else {
        const created = await createTaskUseCase.execute(user, {
          title,
          description,
          dueDate: fromDateInputValue(dueDate),
          areaId,
          routeCode,
          assignToAllTechnicians: assignToAll,
          assignedTechnicianIds: assignedIds,
        })
        setTasks((current) => [created, ...current])
        swalSuccess('Tarea asignada')
      }
      setModalOpen(false)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo guardar la tarea',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleStart(task: Task) {
    if (!user || busy) return
    setBusy(true)
    try {
      const updated = await startTaskUseCase.execute(user, task.id)
      setTasks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      swalSuccess('Tarea en progreso')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo iniciar la tarea',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleComplete(task: Task) {
    if (!user || busy) return
    setBusy(true)
    try {
      const updated = await completeTaskUseCase.execute(user, task.id)
      setTasks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      swalSuccess('Tarea completada')
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo completar la tarea',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(task: Task) {
    if (!user || busy) return
    const confirmed = await swalConfirmDelete({
      title: '¿Eliminar tarea?',
      text: `"${task.title}" se eliminará para los técnicos asignados.`,
    })
    if (!confirmed) return
    setTasks((current) => current.filter((item) => item.id !== task.id))
    swalSuccess('Tarea eliminada')
    try {
      await deleteTaskUseCase.execute(user, task.id)
    } catch (err) {
      setTasks((current) =>
        [task, ...current].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        ),
      )
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo eliminar la tarea',
      )
    }
  }

  if (!user) return null

  return (
    <section className="tasks-page">
      <div className="page-header">
        <div>
          <p className="tasks-page__eyebrow">Campo</p>
          <h1>Tareas</h1>
          <p>
            {isAdmin
              ? 'Asigna trabajos a técnicos: actividad, suministro y fecha límite.'
              : 'Tus tareas asignadas. Márcalas en progreso o completadas.'}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn btn--soft-primary"
            onClick={openCreate}
            disabled={busy}
          >
            <IconPlus />
            Nueva tarea
          </button>
        ) : null}
      </div>

      <div className="tasks-summary" aria-label="Resumen">
        <button
          type="button"
          className={statusFilter === 'all' ? 'is-active' : ''}
          onClick={() => setStatusFilter('all')}
        >
          <strong>{counts.all}</strong>
          <span>todas</span>
        </button>
        <button
          type="button"
          className={statusFilter === TaskStatus.Pendiente ? 'is-active' : ''}
          onClick={() => setStatusFilter(TaskStatus.Pendiente)}
        >
          <strong>{counts.pendiente}</strong>
          <span>pendientes</span>
        </button>
        <button
          type="button"
          className={statusFilter === TaskStatus.EnProgreso ? 'is-active' : ''}
          onClick={() => setStatusFilter(TaskStatus.EnProgreso)}
        >
          <strong>{counts.progreso}</strong>
          <span>en progreso</span>
        </button>
        <button
          type="button"
          className={statusFilter === TaskStatus.Completada ? 'is-active' : ''}
          onClick={() => setStatusFilter(TaskStatus.Completada)}
        >
          <strong>{counts.hecha}</strong>
          <span>hechas</span>
        </button>
      </div>

      <label className="tasks-search">
        <span className="sr-only">Buscar tareas</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar por título, técnico, actividad o código…"
        />
      </label>

      <div className="tasks-map panel">
        <div className="tasks-map__head">
          <div>
            <p className="tasks-page__eyebrow">Ubicaciones</p>
            <h2>Suministros de las tareas</h2>
            <p>
              {filteredMapPoints.length === 0
                ? 'Las tareas con código de suministro aparecen aquí cuando hay GPS en el catálogo.'
                : `${filteredMapPoints.length} suministro${filteredMapPoints.length === 1 ? '' : 's'} ubicado${filteredMapPoints.length === 1 ? '' : 's'} en el mapa.`}
            </p>
          </div>
        </div>
        <div ref={mapContainerRef} className="tasks-map__canvas" />
      </div>

      {loading ? (
        <div className="tasks-empty">
          <div className="tasks-empty__spinner" />
          <p>Cargando tareas…</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="tasks-empty panel">
          <h2>{tasks.length === 0 ? 'Sin tareas' : 'Sin resultados'}</h2>
          <p>
            {tasks.length === 0
              ? isAdmin
                ? 'Crea la primera tarea y asígnala a uno o más técnicos.'
                : 'Aún no te han asignado tareas.'
              : 'Prueba otro filtro o búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="tasks-list">
          {filteredTasks.map((task) => {
            const point = pointByTaskId.get(task.id)
            const selected = selectedTaskId === task.id
            return (
              <article
                key={task.id}
                className={`tasks-card tasks-card--${task.status.toLowerCase()}${selected ? ' is-selected' : ''}`}
                onClick={() => {
                  if (point) setSelectedTaskId(task.id)
                }}
              >
                <div className="tasks-card__top">
                  <span className="tasks-card__status">
                    {taskStatusLabel(task.status)}
                  </span>
                  <span className="tasks-card__due">
                    Límite: {formatDate(task.dueDate)}
                  </span>
                </div>
                <h2>{task.title}</h2>
                <p>
                  {task.description.trim()
                    ? task.description
                    : 'Sin descripción'}
                </p>
                <div className="tasks-card__meta">
                  <span>{formatTaskAssignees(task)}</span>
                  {task.areaName ? <span>{task.areaName}</span> : null}
                  {task.routeCode ? (
                    <span>Suministro {task.routeCode}</span>
                  ) : null}
                  {point ? (
                    <span>
                      {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                    </span>
                  ) : null}
                </div>
                <div className="tasks-card__actions">
                  {point ? (
                    <button
                      type="button"
                      className="btn btn--soft-blue btn--small"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedTaskId(task.id)
                        openSupplyMaps(point.latitude, point.longitude)
                      }}
                    >
                      Ver en Maps
                    </button>
                  ) : null}
                  {task.status === TaskStatus.Pendiente ? (
                    <button
                      type="button"
                      className="btn btn--soft-blue btn--small"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleStart(task)
                      }}
                      disabled={busy}
                    >
                      Empezar
                    </button>
                  ) : null}
                  {task.status !== TaskStatus.Completada ? (
                    <button
                      type="button"
                      className="btn btn--soft-primary btn--small"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleComplete(task)
                      }}
                      disabled={busy}
                    >
                      Completar
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--soft-muted btn--small"
                        onClick={(event) => {
                          event.stopPropagation()
                          openEdit(task)
                        }}
                        disabled={busy}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--soft-rose btn--small"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDelete(task)
                        }}
                        disabled={busy}
                      >
                        Eliminar
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? 'Editar tarea' : 'Nueva tarea'}
        description="Define el trabajo, el suministro y a quién se lo asignas. Las fotos del técnico van a la actividad elegida, en la carpeta del suministro y la fecha del día."
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
              form="task-form"
              className="btn btn--soft-primary"
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="task-form" onSubmit={(event) => void handleSave(event)}>
          <div className="tasks-form">
            <label className="field">
              <span>Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Notificar cortes en sector 03"
                required
                maxLength={160}
              />
            </label>
            <label className="field">
              <span>Descripción (opcional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={1000}
              />
            </label>
            <div className="tasks-form__row">
              <label className="field">
                <span>Fecha límite</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Actividad</span>
                <select
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  required
                >
                  <option value="">Selecciona actividad</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Código de suministro</span>
              <input
                value={routeCode}
                onChange={(event) => setRouteCode(event.target.value)}
                placeholder="Ej. 12030003803"
                inputMode="numeric"
                required
              />
            </label>
            <TaskAssigneePicker
              assignToAllTechnicians={assignToAll}
              assignedTechnicianIds={assignedIds}
              technicians={technicians}
              onAssignAll={() => {
                setAssignToAll(true)
                setAssignedIds([])
              }}
              onAssignSpecific={() => setAssignToAll(false)}
              onToggleTechnician={(id) => {
                setAssignedIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                )
              }}
            />
          </div>
        </form>
      </AppModal>
    </section>
  )
}
