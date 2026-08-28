import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Area } from '@/domain/entities/Area'
import type { Task } from '@/domain/entities/Task'
import {
  formatTaskAssignees,
  normalizeTaskRoutes,
  TaskStatus,
  taskRouteHasMapPoint,
  taskStatusLabel,
  taskTitleFromActivity,
} from '@/domain/entities/Task'
import { supplyHasLocation } from '@/domain/entities/Supply'
import type { Supply } from '@/domain/entities/Supply'
import type { User } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import { supplyFolderDocId } from '@/domain/services/SupplyFolderService'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirmDelete,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import Swal from 'sweetalert2'
import './FoldersPage.css'
import './TasksPage.css'

type TaskMapPoint = {
  task: Task
  routeCode: string
  completed: boolean
  completedByName: string
  completedAt: Date | null
  claimedByName: string
  photosUploaded: boolean
  latitude: number
  longitude: number
}

type DraftRoute = {
  routeCode: string
  latitude: number | null
  longitude: number | null
  note: string
  hasLocation: boolean
  isNew: boolean
}

const DEFAULT_CENTER: L.LatLngExpression = [-12.5933, -69.1891]

function statusPinClass(completed: boolean, claimed: boolean): string {
  if (completed) return 'tasks-pin__dot--done'
  if (claimed) return 'tasks-pin__dot--claimed'
  return 'tasks-pin__dot--pending'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function photosPath(areaId: string, routeCode: string): string {
  return `/carpetas/${supplyFolderDocId(areaId, routeCode)}`
}

function formatCompletedAt(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
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

const STATUS_ORDER: Record<string, number> = {
  [TaskStatus.Pendiente]: 0,
  [TaskStatus.EnProgreso]: 1,
  [TaskStatus.Completada]: 2,
}

function sameLabel(left: string, right: string): boolean {
  return left.trim().toLocaleUpperCase('es') === right.trim().toLocaleUpperCase('es')
}

function taskHeading(task: Task): string {
  if (task.areaName && sameLabel(task.title, task.areaName)) {
    const description = task.description.trim()
    if (description) return description
    const routes = normalizeTaskRoutes(task)
    if (routes.length === 1) return `Suministro ${routes[0]?.routeCode ?? ''}`
    return `${routes.length} suministros`
  }
  return task.title
}

interface ActivityGroup {
  areaId: string
  areaName: string
  tasks: Task[]
  doneRoutes: number
  totalRoutes: number
}

function groupTasksByActivity(tasks: Task[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>()
  for (const task of tasks) {
    const areaId = task.areaId.trim() || `sin:${task.areaName.trim() || task.id}`
    const areaName = task.areaName.trim() || 'Sin actividad'
    const routes = normalizeTaskRoutes(task)
    const current = groups.get(areaId)
    if (current) {
      current.tasks.push(task)
      current.doneRoutes += routes.filter((route) => route.completed).length
      current.totalRoutes += routes.length
      continue
    }
    groups.set(areaId, {
      areaId,
      areaName,
      tasks: [task],
      doneRoutes: routes.filter((route) => route.completed).length,
      totalRoutes: routes.length,
    })
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      tasks: [...group.tasks].sort((left, right) => {
        const byStatus =
          (STATUS_ORDER[left.status] ?? 9) - (STATUS_ORDER[right.status] ?? 9)
        if (byStatus !== 0) return byStatus
        const leftDue = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
        const rightDue = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
        if (leftDue !== rightDue) return leftDue - rightDue
        return left.title.localeCompare(right.title, 'es')
      }),
    }))
    .sort((left, right) => left.areaName.localeCompare(right.areaName, 'es'))
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
  const navigate = useNavigate()
  const {
    listTasksUseCase,
    createTaskUseCase,
    updateTaskUseCase,
    deleteTaskUseCase,
    listTechniciansUseCase,
    listAreasUseCase,
    getSupplyByRouteCodeUseCase,
    searchSuppliesUseCase,
  } = useDependencies()

  const isAdmin = Boolean(user && canManageUsers(user.role))
  const [tasks, setTasks] = useState<Task[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [areaFilter, setAreaFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [mapPoints, setMapPoints] = useState<TaskMapPoint[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedRouteCode, setSelectedRouteCode] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [collapsedAreas, setCollapsedAreas] = useState<string[]>([])

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [areaId, setAreaId] = useState('')
  const [routeDraft, setRouteDraft] = useState('')
  const [routeSuggestions, setRouteSuggestions] = useState<Supply[]>([])
  const [searchingRoutes, setSearchingRoutes] = useState(false)
  const [draftRoutes, setDraftRoutes] = useState<DraftRoute[]>([])
  const [assignToAll, setAssignToAll] = useState(false)
  const [assignedIds, setAssignedIds] = useState<string[]>([])

  const selectedAreaName = areas.find((area) => area.id === areaId)?.name ?? ''

  const filteredTasks = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === 'all' || task.status === statusFilter
      if (!matchesStatus) return false
      if (areaFilter && task.areaId !== areaFilter) return false
      if (!query) return true
      const routes = normalizeTaskRoutes(task)
        .map((route) => route.routeCode)
        .join(' ')
      const haystack =
        `${task.title} ${task.description} ${task.areaName} ${routes} ${formatTaskAssignees(task)}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [tasks, deferredSearch, statusFilter, areaFilter])

  const activityGroups = useMemo(
    () => groupTasksByActivity(filteredTasks),
    [filteredTasks],
  )

  const activityOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const area of areas) {
      if (area.id) byId.set(area.id, area.name)
    }
    for (const task of tasks) {
      if (task.areaId && !byId.has(task.areaId)) {
        byId.set(task.areaId, task.areaName.trim() || 'Actividad')
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }, [areas, tasks])

  const filteredMapPoints = useMemo(() => {
    const ids = new Set(filteredTasks.map((task) => task.id))
    const visible = mapPoints.filter((point) => ids.has(point.task.id))
    if (selectedTaskId) {
      return visible.filter((point) => point.task.id === selectedTaskId)
    }
    if (selectedAreaId) {
      return visible.filter((point) => point.task.areaId === selectedAreaId)
    }
    return visible
  }, [filteredTasks, mapPoints, selectedTaskId, selectedAreaId])

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  )

  const selectedActivityName = useMemo(() => {
    if (selectedTask?.areaName.trim()) return selectedTask.areaName.trim()
    if (!selectedAreaId) return ''
    return (
      activityGroups.find((group) => group.areaId === selectedAreaId)
        ?.areaName ??
      activityOptions.find((item) => item.id === selectedAreaId)?.name ??
      ''
    )
  }, [selectedTask, selectedAreaId, activityGroups, activityOptions])

  const pointsByTaskId = useMemo(() => {
    const map = new Map<string, TaskMapPoint[]>()
    for (const point of mapPoints) {
      const list = map.get(point.task.id) ?? []
      list.push(point)
      map.set(point.task.id, list)
    }
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

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    void Promise.all([
      listAreasUseCase.execute(user),
      listTechniciansUseCase.execute(user),
    ])
      .then(([nextAreas, nextTechs]) => {
        if (cancelled) return
        setAreas(nextAreas)
        setTechnicians(nextTechs)
      })
      .catch((err) => {
        if (cancelled) return
        swalError(
          err instanceof DomainError
            ? err.message
            : 'No se pudieron cargar las tareas',
        )
      })

    const stop = listTasksUseCase.watch(
      user,
      (nextTasks) => {
        if (cancelled) return
        setTasks(nextTasks)
        setLoading(false)
      },
      () => {
        if (cancelled) return
        setLoading(false)
        swalError('No se pudieron actualizar las tareas')
      },
    )

    return () => {
      cancelled = true
      stop()
    }
  }, [user, listTasksUseCase, listAreasUseCase, listTechniciansUseCase])

  useEffect(() => {
    if (!user || !modalOpen) {
      setRouteSuggestions([])
      setSearchingRoutes(false)
      return
    }
    const digits = normalizeRouteCode(routeDraft)
    if (digits.length < 3) {
      setRouteSuggestions([])
      setSearchingRoutes(false)
      return
    }

    let cancelled = false
    setSearchingRoutes(true)
    const handle = window.setTimeout(() => {
      void searchSuppliesUseCase
        .execute(user, digits)
        .then((hits) => {
          if (cancelled) return
          const taken = new Set(draftRoutes.map((route) => route.routeCode))
          setRouteSuggestions(
            hits.filter((supply) => !taken.has(supply.routeCode)),
          )
        })
        .catch(() => {
          if (!cancelled) setRouteSuggestions([])
        })
        .finally(() => {
          if (!cancelled) setSearchingRoutes(false)
        })
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [routeDraft, user, modalOpen, draftRoutes, searchSuppliesUseCase])

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
        for (const route of normalizeTaskRoutes(task)) {
          if (taskRouteHasMapPoint(route)) {
            points.push({
              task,
              routeCode: route.routeCode,
              completed: route.completed,
              completedByName: route.completedByName,
              completedAt: route.completedAt,
              claimedByName: route.claimedByName,
              photosUploaded: route.photosUploaded,
              latitude: route.latitude!,
              longitude: route.longitude!,
            })
            continue
          }
          const code = route.routeCode.trim()
          if (!code) continue
          const bucket = missingCodes.get(code) ?? []
          bucket.push(task)
          missingCodes.set(code, bucket)
        }
      }

      await Promise.all(
        [...missingCodes.entries()].map(async ([code, linked]) => {
          try {
            const supply = await getSupplyByRouteCodeUseCase.find(user!, code)
            if (!supply || cancelled || !supplyHasLocation(supply)) return
            for (const task of linked) {
              const route = normalizeTaskRoutes(task).find(
                (item) => item.routeCode === code,
              )
              points.push({
                task,
                routeCode: code,
                completed: route?.completed === true,
                completedByName: route?.completedByName ?? '',
                completedAt: route?.completedAt ?? null,
                claimedByName: route?.claimedByName ?? '',
                photosUploaded: route?.photosUploaded === true,
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
      const selected =
        point.task.id === selectedTaskId &&
        (selectedRouteCode == null || selectedRouteCode === point.routeCode)
      const photosHref = photosPath(point.task.areaId, point.routeCode)
      const who = point.completed
        ? point.completedByName
          ? `Completó: ${escapeHtml(point.completedByName)}${
              point.completedAt
                ? ` · ${escapeHtml(formatCompletedAt(point.completedAt))}`
                : ''
            }`
          : 'Completado'
        : point.claimedByName
          ? `Tomado por ${escapeHtml(point.claimedByName)}`
          : 'Libre'
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: 'tasks-pin',
          html: `<span class="tasks-pin__dot ${statusPinClass(point.completed, Boolean(point.claimedByName))}${selected ? ' is-selected' : ''}"></span><span class="tasks-pin__code">${escapeHtml(point.routeCode)}</span>`,
          iconSize: [96, 36],
          iconAnchor: [16, 30],
        }),
        zIndexOffset: selected ? 900 : point.completed ? 600 : 400,
      })
      marker.bindPopup(
        `<strong>${escapeHtml(point.task.title)}</strong><br/>Suministro ${escapeHtml(point.routeCode)}<br/><small>${who}</small><br/><a class="tasks-pin__photos" href="${photosHref}">Ver fotos</a>`,
      )
      marker.on('click', () => {
        setSelectedTaskId(point.task.id)
        setSelectedRouteCode(point.routeCode)
      })
      marker.on('popupopen', () => {
        const link = document.querySelector<HTMLAnchorElement>(
          `a.tasks-pin__photos[href="${photosHref}"]`,
        )
        if (!link) return
        link.addEventListener(
          'click',
          (event) => {
            event.preventDefault()
            navigate(photosHref, {
              state: {
                areaName: point.task.areaName,
                routeCode: point.routeCode,
              },
            })
          },
          { once: true },
        )
      })
      marker.addTo(layer)
      bounds.extend([point.latitude, point.longitude])
    }

    const selectedPoint =
      filteredMapPoints.find(
        (point) =>
          point.task.id === selectedTaskId &&
          (!selectedRouteCode || point.routeCode === selectedRouteCode),
      ) ?? filteredMapPoints[0]
    if (selectedPoint && selectedTaskId) {
      map.setView(
        [selectedPoint.latitude, selectedPoint.longitude],
        Math.max(map.getZoom(), 15),
      )
    } else if (filteredMapPoints.length === 1) {
      map.setView(
        [filteredMapPoints[0].latitude, filteredMapPoints[0].longitude],
        15,
      )
    } else {
      map.fitBounds(bounds.pad(0.18), { maxZoom: 16 })
    }
    window.setTimeout(() => map.invalidateSize({ animate: false }), 50)
  }, [filteredMapPoints, selectedTaskId, selectedRouteCode, navigate])

  function openCreate() {
    setEditing(null)
    setDescription('')
    setDueDate('')
    setAreaId('')
    setRouteDraft('')
    setRouteSuggestions([])
    setDraftRoutes([])
    setAssignToAll(false)
    setAssignedIds([])
    setModalOpen(true)
  }

  function openEdit(task: Task) {
    setEditing(task)
    setDescription(task.description)
    setDueDate(toDateInputValue(task.dueDate))
    setAreaId(task.areaId)
    setRouteDraft('')
    setRouteSuggestions([])
    setDraftRoutes(
      normalizeTaskRoutes(task).map((route) => ({
        routeCode: route.routeCode,
        latitude: route.latitude,
        longitude: route.longitude,
        note: route.note,
        hasLocation: taskRouteHasMapPoint(route),
        isNew: false,
      })),
    )
    setAssignToAll(task.assignToAllTechnicians)
    setAssignedIds([...new Set(task.assignedTechnicianIds)])
    setModalOpen(true)
  }

  function addDraftRoute(route: DraftRoute) {
    setDraftRoutes((current) => {
      if (current.some((item) => item.routeCode === route.routeCode)) {
        return current
      }
      return [...current, route]
    })
    setRouteDraft('')
    setRouteSuggestions([])
  }

  function pickSupply(supply: Supply) {
    if (draftRoutes.some((route) => route.routeCode === supply.routeCode)) {
      swalError('Esa ruta ya está en la tarea')
      return
    }
    addDraftRoute({
      routeCode: supply.routeCode,
      latitude: supply.latitude,
      longitude: supply.longitude,
      note: supply.note,
      hasLocation: supplyHasLocation(supply),
      isNew: false,
    })
  }

  async function handleAddRoute() {
    if (!user) return
    const code = normalizeRouteCode(routeDraft)
    if (!isRouteCode(code)) {
      swalError('Ingresa un código de suministro de 7 a 12 dígitos')
      return
    }
    if (draftRoutes.some((route) => route.routeCode === code)) {
      swalError('Esa ruta ya está en la tarea')
      return
    }

    try {
      const supply = await getSupplyByRouteCodeUseCase.find(user, code)
      if (!supply) {
        const result = await Swal.fire({
          icon: 'question',
          title: 'Ruta no está en el catálogo',
          text: 'Se guardará sin ubicación. El técnico podrá activar el GPS en el punto.',
          input: 'textarea',
          inputPlaceholder: 'Descripción opcional',
          inputAttributes: { maxlength: '200' },
          showCancelButton: true,
          confirmButtonText: 'Agregar ruta',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#1e88e5',
          animation: false,
        })
        if (!result.isConfirmed) return
        setDraftRoutes((current) => [
          ...current,
          {
            routeCode: code,
            latitude: null,
            longitude: null,
            note: String(result.value ?? '').trim().slice(0, 200),
            hasLocation: false,
            isNew: true,
          },
        ])
        setRouteDraft('')
        setRouteSuggestions([])
        return
      }

      addDraftRoute({
        routeCode: code,
        latitude: supply.latitude,
        longitude: supply.longitude,
        note: supply.note,
        hasLocation: supplyHasLocation(supply),
        isNew: false,
      })
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo buscar la ruta',
      )
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!user || busy) return
    if (draftRoutes.length === 0) {
      swalError('Agrega al menos una ruta de suministro')
      return
    }
    setBusy(true)
    try {
      const routes = draftRoutes.map((route) => ({
        routeCode: route.routeCode,
        note: route.note,
      }))
      if (editing) {
        const updated = await updateTaskUseCase.execute(user, editing.id, {
          description,
          dueDate: fromDateInputValue(dueDate),
          areaId,
          routes,
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
          description,
          dueDate: fromDateInputValue(dueDate),
          areaId,
          routes,
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

  function clearMapFocus() {
    setSelectedTaskId(null)
    setSelectedRouteCode(null)
    setSelectedAreaId(null)
  }

  function selectActivity(nextAreaId: string) {
    setSelectedAreaId(nextAreaId)
    setSelectedTaskId(null)
    setSelectedRouteCode(null)
  }

  function toggleActivity(nextAreaId: string) {
    setCollapsedAreas((current) =>
      current.includes(nextAreaId)
        ? current.filter((id) => id !== nextAreaId)
        : [...current, nextAreaId],
    )
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
              ? 'Las tareas se agrupan por actividad. El técnico completa cada punto en el aplicativo; aquí ves el avance, quién lo cerró y las fotos.'
              : 'Tus tareas, agrupadas por actividad. El avance se marca desde el aplicativo.'}
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

      <div className="tasks-toolbar">
        <label className="tasks-search">
          <span className="sr-only">Buscar tareas</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por título, técnico, actividad o código…"
          />
        </label>
        {activityOptions.length > 0 ? (
          <label className="tasks-filter">
            <span>Actividad</span>
            <select
              value={areaFilter}
              onChange={(event) => {
                const next = event.target.value
                setAreaFilter(next)
                if (next) selectActivity(next)
                else if (selectedAreaId) setSelectedAreaId(null)
              }}
            >
              <option value="">Todas</option>
              {activityOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="tasks-map panel">
        <div className="tasks-map__head">
          <div>
            <p className="tasks-page__eyebrow">Ubicaciones</p>
            <h2>
              {selectedActivityName || 'Suministros por actividad'}
            </h2>
            <p>
              {filteredMapPoints.length === 0
                ? selectedTask
                  ? `«${taskHeading(selectedTask)}» aún no tiene puntos con GPS.`
                  : selectedActivityName
                    ? 'Esta actividad aún no tiene puntos con GPS.'
                    : 'Elige una actividad o una tarea para ver sus puntos. El técnico los marca en verde al completarlos.'
                : selectedTask
                  ? `${filteredMapPoints.length} punto${filteredMapPoints.length === 1 ? '' : 's'} de «${taskHeading(selectedTask)}». Verde = completado.`
                  : selectedActivityName
                    ? `${filteredMapPoints.length} punto${filteredMapPoints.length === 1 ? '' : 's'} de ${selectedActivityName}.`
                    : `${filteredMapPoints.length} punto${filteredMapPoints.length === 1 ? '' : 's'} en las actividades visibles.`}
            </p>
          </div>
          {selectedTask || selectedAreaId ? (
            <button
              type="button"
              className="btn btn--soft-muted btn--small"
              onClick={clearMapFocus}
            >
              Ver todas
            </button>
          ) : null}
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
          {activityGroups.map((group) => {
            const collapsed = collapsedAreas.includes(group.areaId)
            const activitySelected =
              selectedAreaId === group.areaId ||
              group.tasks.some((task) => task.id === selectedTaskId)
            const progress =
              group.totalRoutes === 0
                ? 0
                : Math.round((group.doneRoutes / group.totalRoutes) * 100)
            return (
              <section
                key={group.areaId}
                className={`tasks-activity${activitySelected ? ' is-selected' : ''}`}
              >
                <header className="tasks-activity__head">
                  <div className="tasks-activity__lead">
                    <button
                      type="button"
                      className="tasks-activity__chevron-btn"
                      aria-expanded={!collapsed}
                      aria-label={
                        collapsed
                          ? `Mostrar tareas de ${group.areaName}`
                          : `Ocultar tareas de ${group.areaName}`
                      }
                      onClick={() => toggleActivity(group.areaId)}
                    >
                      <span className="tasks-activity__chevron" aria-hidden="true">
                        {collapsed ? '▸' : '▾'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="tasks-activity__toggle"
                      onClick={() => {
                        selectActivity(group.areaId)
                        setCollapsedAreas((current) =>
                          current.filter((id) => id !== group.areaId),
                        )
                      }}
                    >
                      <strong>{group.areaName}</strong>
                      <small>
                        {group.tasks.length} tarea
                        {group.tasks.length === 1 ? '' : 's'}
                        {group.totalRoutes > 0
                          ? ` · ${group.doneRoutes}/${group.totalRoutes} puntos`
                          : ''}
                      </small>
                    </button>
                  </div>
                  <div className="tasks-activity__aside">
                    <div
                      className="tasks-activity__bar"
                      aria-label={`${progress}% completado`}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <button
                      type="button"
                      className="btn btn--soft-muted btn--small"
                      onClick={() => {
                        selectActivity(group.areaId)
                        setCollapsedAreas((current) =>
                          current.filter((id) => id !== group.areaId),
                        )
                      }}
                    >
                      Ver en mapa
                    </button>
                  </div>
                </header>
                {collapsed ? null : (
                  <div className="tasks-activity__tasks">
                    {group.tasks.map((task) => {
                      const routes = normalizeTaskRoutes(task)
                      const taskPoints = pointsByTaskId.get(task.id) ?? []
                      const selected = selectedTaskId === task.id
                      const doneCount = routes.filter(
                        (route) => route.completed,
                      ).length
                      const heading = taskHeading(task)
                      const showDescription =
                        task.description.trim() &&
                        heading !== task.description.trim()
                      return (
                        <article
                          key={task.id}
                          className={`tasks-card tasks-card--${task.status.toLowerCase()}${selected ? ' is-selected' : ''}`}
                          onClick={() => {
                            setSelectedTaskId(task.id)
                            setSelectedRouteCode(null)
                            setSelectedAreaId(task.areaId || group.areaId)
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
                          <h2>{heading}</h2>
                          {showDescription ? (
                            <p>{task.description}</p>
                          ) : !task.description.trim() ? (
                            <p>Sin descripción</p>
                          ) : null}
                          <div className="tasks-card__meta">
                            <span>{formatTaskAssignees(task)}</span>
                            <span>
                              {doneCount}/{routes.length || 0} puntos
                              completados
                            </span>
                          </div>
                          <ul className="tasks-routes-list">
                            {routes.map((route) => {
                              const point = taskPoints.find(
                                (item) => item.routeCode === route.routeCode,
                              )
                              const active =
                                selected &&
                                selectedRouteCode === route.routeCode
                              return (
                                <li
                                  key={route.routeCode}
                                  className={`tasks-routes-list__item${route.completed ? ' is-done' : ''}${active ? ' is-active' : ''}`}
                                >
                                  <button
                                    type="button"
                                    className="tasks-routes-list__select"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setSelectedTaskId(task.id)
                                      setSelectedRouteCode(route.routeCode)
                                      setSelectedAreaId(
                                        task.areaId || group.areaId,
                                      )
                                    }}
                                  >
                                    <span
                                      className={`tasks-routes-list__dot ${route.completed ? 'is-done' : 'is-pending'}`}
                                    />
                                    <span className="tasks-routes-list__copy">
                                      <strong>
                                        Suministro {route.routeCode}
                                      </strong>
                                      <small>
                                        {route.completed
                                          ? `Completó ${route.completedByName || 'un técnico'}${
                                              route.completedAt
                                                ? ` · ${formatCompletedAt(route.completedAt)}`
                                                : ''
                                            }`
                                          : route.claimedByName
                                            ? `Tomado por ${route.claimedByName}${
                                                route.photosUploaded
                                                  ? ' · con fotos'
                                                  : ''
                                              }`
                                            : 'Libre · el técnico debe agarrarlo'}
                                      </small>
                                    </span>
                                  </button>
                                  <div className="tasks-routes-list__actions">
                                    {point ? (
                                      <button
                                        type="button"
                                        className="btn btn--soft-blue btn--small"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setSelectedTaskId(task.id)
                                          setSelectedRouteCode(route.routeCode)
                                          openSupplyMaps(
                                            point.latitude,
                                            point.longitude,
                                          )
                                        }}
                                      >
                                        Mapa
                                      </button>
                                    ) : null}
                                    <Link
                                      className="btn btn--soft-primary btn--small"
                                      to={photosPath(task.areaId, route.routeCode)}
                                      state={{
                                        areaName: task.areaName,
                                        routeCode: route.routeCode,
                                      }}
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      Fotos
                                    </Link>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                          {isAdmin ? (
                            <div className="tasks-card__actions">
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
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <AppModal
        open={modalOpen}
        title={editing ? 'Editar tarea' : 'Nueva tarea'}
        description="El título se toma de la actividad. Puedes asignar varias rutas; si una no existe se guarda sin ubicación para que el técnico marque el GPS."
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
            <div className="tasks-form__row">
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
              <label className="field">
                <span>Fecha límite</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>
            <p className="tasks-form__title-preview">
              Título de la tarea:{' '}
              <strong>
                {selectedAreaName
                  ? taskTitleFromActivity(selectedAreaName)
                  : 'elige una actividad'}
              </strong>
            </p>
            <label className="field">
              <span>Descripción (opcional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={1000}
              />
            </label>
            <div className="field">
              <span>Rutas de suministro</span>
              <div className="tasks-routes__search">
                <div className="tasks-routes__add">
                  <input
                    value={routeDraft}
                    onChange={(event) => setRouteDraft(event.target.value)}
                    placeholder="Buscar por código o últimos dígitos"
                    inputMode="numeric"
                    autoComplete="off"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        if (routeSuggestions.length === 1) {
                          pickSupply(routeSuggestions[0])
                          return
                        }
                        void handleAddRoute()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--soft-blue btn--small"
                    onClick={() => void handleAddRoute()}
                  >
                    Agregar
                  </button>
                </div>
                {searchingRoutes ? (
                  <p className="tasks-routes__hint">Buscando suministros…</p>
                ) : null}
                {routeSuggestions.length > 0 ? (
                  <ul className="tasks-routes__suggest" role="listbox">
                    {routeSuggestions.map((supply) => (
                      <li key={supply.routeCode}>
                        <button
                          type="button"
                          onClick={() => pickSupply(supply)}
                        >
                          <strong>{supply.routeCode}</strong>
                          <small>
                            {supplyHasLocation(supply)
                              ? 'Con GPS'
                              : 'Sin GPS'}
                            {supply.note ? ` · ${supply.note}` : ''}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : normalizeRouteCode(routeDraft).length >= 3 &&
                  !searchingRoutes ? (
                  <p className="tasks-routes__hint">
                    Sin coincidencias. Puedes agregarla igual si es una ruta
                    nueva.
                  </p>
                ) : normalizeRouteCode(routeDraft).length < 3 ? (
                  <p className="tasks-routes__hint">
                    Escribe al menos 3 dígitos. También sirve con los últimos
                    del código.
                  </p>
                ) : null}
              </div>
              {draftRoutes.length === 0 ? (
                <p className="tasks-routes__empty">
                  Agrega una o más rutas. Si no existe, se crea sin ubicación.
                </p>
              ) : (
                <ul className="tasks-routes">
                  {draftRoutes.map((route) => (
                    <li key={route.routeCode} className="tasks-routes__item">
                      <div>
                        <strong>{route.routeCode}</strong>
                        <small>
                          {route.hasLocation
                            ? 'Con GPS'
                            : route.isNew
                              ? 'Nueva · sin GPS'
                              : 'Sin GPS'}
                          {route.note ? ` · ${route.note}` : ''}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn--soft-rose btn--small"
                        onClick={() =>
                          setDraftRoutes((current) =>
                            current.filter(
                              (item) => item.routeCode !== route.routeCode,
                            ),
                          )
                        }
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
