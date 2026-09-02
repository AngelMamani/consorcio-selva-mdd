import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AttendanceOrigin,
  attendanceOriginLabel,
  formatAttendanceTime,
  toLimaDateKey,
  type Attendance,
} from '@/domain/entities/Attendance'
import { formatDateKey } from '@/domain/entities/FolderDate'
import { personalFullName, personalRoleIds } from '@/domain/entities/Personal'
import type { Personal } from '@/domain/entities/Personal'
import {
  supportTicketKindLabel,
  type SupportTicket,
} from '@/domain/entities/SupportTicket'
import {
  TaskStatus,
  taskStatusLabel,
  type Task,
} from '@/domain/entities/Task'
import type { AttendanceDayRow } from '@/domain/usecases/attendance/AttendanceUseCases'
import { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { usePermissions } from '@/presentation/providers/PermissionsProvider'
import './HomePage.css'

const MISSING_PREVIEW = 8
const TASK_PREVIEW = 6
const TICKET_PREVIEW = 3
const WITHOUT_ROLE_PREVIEW = 5

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/).filter(Boolean)[0] || 'equipo'
}

function capitalizeDateLabel(dateKey: string): string {
  const label = formatDateKey(dateKey)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function limaDayOf(date: Date | null | undefined): string {
  if (!date) return ''
  return toLimaDateKey(date)
}

function taskDueRank(task: Task, todayKey: string): number {
  const due = limaDayOf(task.dueDate)
  if (due && due < todayKey) return 0
  if (due === todayKey) return 1
  if (task.status === TaskStatus.EnProgreso) return 2
  return 3
}

function myMarkLabel(attendance: Attendance | null): string {
  if (!attendance) return 'Aún no marcas asistencia hoy.'
  if (attendance.origin === AttendanceOrigin.Permiso) {
    return 'Hoy tienes permiso registrado.'
  }
  return `Hoy marcaste en ${attendanceOriginLabel(attendance.origin).toLowerCase()} a las ${formatAttendanceTime(attendance.createdAt)}.`
}

export function HomePage() {
  const { user } = useAuth()
  const { canAccessMenu } = usePermissions()
  const {
    listAttendanceDayUseCase,
    getMyTodayAttendanceUseCase,
    listTasksUseCase,
    listPersonalUseCase,
    listSupportTicketsUseCase,
  } = useDependencies()

  const todayKey = toLimaDateKey()
  const showAttendance = canAccessMenu(AppMenuKey.Asistencias)
  const showTracking = canAccessMenu(AppMenuKey.Seguimiento)
  const showTasks = canAccessMenu(AppMenuKey.Tareas)
  const showPersonal = canAccessMenu(AppMenuKey.Personal)
  const showSupport = canAccessMenu(AppMenuKey.Soporte)

  const [loading, setLoading] = useState(true)
  const [attendanceRows, setAttendanceRows] = useState<AttendanceDayRow[]>([])
  const [myAttendance, setMyAttendance] = useState<Attendance | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [people, setPeople] = useState<Personal[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])

  useEffect(() => {
    if (!user) return
    const actor = user
    let cancelled = false

    async function load() {
      setLoading(true)
      const [attendanceResult, mineResult, tasksResult, peopleResult, ticketsResult] =
        await Promise.allSettled([
          showAttendance
            ? listAttendanceDayUseCase.execute(actor, todayKey)
            : Promise.resolve([] as AttendanceDayRow[]),
          showAttendance
            ? getMyTodayAttendanceUseCase.execute(actor, todayKey)
            : Promise.resolve(null),
          showTasks ? listTasksUseCase.execute(actor) : Promise.resolve([] as Task[]),
          showPersonal
            ? listPersonalUseCase.execute(actor)
            : Promise.resolve([] as Personal[]),
          showSupport
            ? listSupportTicketsUseCase.execute(actor)
            : Promise.resolve([] as SupportTicket[]),
        ])
      if (cancelled) return
      setAttendanceRows(settledValue(attendanceResult, []))
      setMyAttendance(settledValue(mineResult, null))
      setTasks(settledValue(tasksResult, []))
      setPeople(settledValue(peopleResult, []))
      setTickets(settledValue(ticketsResult, []))
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    user,
    todayKey,
    showAttendance,
    showTasks,
    showPersonal,
    showSupport,
    listAttendanceDayUseCase,
    getMyTodayAttendanceUseCase,
    listTasksUseCase,
    listPersonalUseCase,
    listSupportTicketsUseCase,
  ])

  const attendanceStats = useMemo(() => {
    const office = attendanceRows.filter(
      (row) => row.attendance?.origin === AttendanceOrigin.Oficina,
    ).length
    const zone = attendanceRows.filter(
      (row) => row.attendance?.origin === AttendanceOrigin.Zona,
    ).length
    const permiso = attendanceRows.filter(
      (row) => row.attendance?.origin === AttendanceOrigin.Permiso,
    ).length
    const missingRows = attendanceRows.filter((row) => !row.attendance)
    return {
      office,
      zone,
      permiso,
      missing: missingRows.length,
      total: attendanceRows.length,
      missingPeople: missingRows.slice(0, MISSING_PREVIEW).map((row) => ({
        id: row.person.id,
        name: row.person.displayName,
      })),
      missingExtra: Math.max(0, missingRows.length - MISSING_PREVIEW),
    }
  }, [attendanceRows])

  const taskStats = useMemo(() => {
    const open = tasks.filter((task) => task.status !== TaskStatus.Completada)
    const overdue = open.filter((task) => {
      const due = limaDayOf(task.dueDate)
      return Boolean(due && due < todayKey)
    })
    const dueToday = open.filter((task) => limaDayOf(task.dueDate) === todayKey)
    const doneToday = tasks.filter(
      (task) =>
        task.status === TaskStatus.Completada && limaDayOf(task.completedAt) === todayKey,
    )
    const preview = [...open]
      .sort((left, right) => {
        const rank = taskDueRank(left, todayKey) - taskDueRank(right, todayKey)
        if (rank !== 0) return rank
        return left.title.localeCompare(right.title, 'es')
      })
      .slice(0, TASK_PREVIEW)
    return {
      pending: tasks.filter((task) => task.status === TaskStatus.Pendiente).length,
      progress: tasks.filter((task) => task.status === TaskStatus.EnProgreso).length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      doneToday: doneToday.length,
      preview,
      extra: Math.max(0, open.length - preview.length),
    }
  }, [tasks, todayKey])

  const withoutRole = useMemo(() => {
    const items = people.filter((person) => personalRoleIds(person).length === 0)
    return {
      count: items.length,
      names: items.slice(0, WITHOUT_ROLE_PREVIEW).map((person) => personalFullName(person)),
      extra: Math.max(0, items.length - WITHOUT_ROLE_PREVIEW),
    }
  }, [people])

  const openTickets = useMemo(() => {
    const items = tickets
      .filter((ticket) => ticket.status === 'ABIERTO')
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    return {
      count: items.length,
      preview: items.slice(0, TICKET_PREVIEW),
    }
  }, [tickets])

  const hasAttention = withoutRole.count > 0 || openTickets.count > 0
  const greetingName = firstName(user?.displayName ?? '')

  if (!user) return null

  return (
    <section className="home-page">
      <header className="home-page__header">
        <div>
          <p className="home-page__eyebrow">Panel</p>
          <h1>Inicio</h1>
          <p>
            Hola, {greetingName}. Esto es lo importante de hoy
            {showAttendance || showTasks ? ', no el listado completo.' : '.'}
          </p>
        </div>
        <p className="home-page__date">{capitalizeDateLabel(todayKey)}</p>
      </header>

      {showAttendance ? (
        <p className="home-page__mine">
          {loading ? 'Cargando tu marca…' : myMarkLabel(myAttendance)}{' '}
          <Link to="/asistencias">Ir a Asistencias</Link>
        </p>
      ) : null}

      {loading ? (
        <p className="home-page__loading">Cargando el día…</p>
      ) : (
        <>
          <div className="home-page__grid">
            {showTracking ? (
              <article className="home-card">
                <header className="home-card__head">
                  <div>
                    <h2>Seguimiento</h2>
                    <p>Ubicación en vivo del aplicativo. Si apagan el GPS, ves la última posición.</p>
                  </div>
                  <Link to="/seguimiento" className="home-card__link">
                    Ver mapa
                  </Link>
                </header>
              </article>
            ) : null}
            {showAttendance ? (
              <article className="home-card">
                <header className="home-card__head">
                  <div>
                    <h2>Asistencia de hoy</h2>
                    <p>
                      {attendanceStats.total} persona
                      {attendanceStats.total === 1 ? '' : 's'} con cuenta activa
                    </p>
                  </div>
                  <Link to="/asistencias" className="home-card__link">
                    Ver listado
                  </Link>
                </header>
                <div className="home-card__kpis">
                  <div className="home-kpi home-kpi--office">
                    <strong>{attendanceStats.office}</strong>
                    <span>Oficina</span>
                  </div>
                  <div className="home-kpi home-kpi--zone">
                    <strong>{attendanceStats.zone}</strong>
                    <span>Campo</span>
                  </div>
                  <div className="home-kpi home-kpi--permiso">
                    <strong>{attendanceStats.permiso}</strong>
                    <span>Permiso</span>
                  </div>
                  <div className="home-kpi home-kpi--missing">
                    <strong>{attendanceStats.missing}</strong>
                    <span>Sin marcar</span>
                  </div>
                </div>
                {attendanceStats.total === 0 ? (
                  <p className="home-card__ok">No hay cuentas activas para marcar hoy.</p>
                ) : attendanceStats.missing > 0 ? (
                  <div className="home-card__list">
                    <h3>Falta marcar</h3>
                    <ul>
                      {attendanceStats.missingPeople.map((person) => (
                        <li key={person.id}>{person.name}</li>
                      ))}
                    </ul>
                    {attendanceStats.missingExtra > 0 ? (
                      <p className="home-card__more">
                        +{attendanceStats.missingExtra} más en Asistencias
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="home-card__ok">Todo el personal activo ya marcó o tiene permiso.</p>
                )}
              </article>
            ) : null}

            {showTasks ? (
              <article className="home-card">
                <header className="home-card__head">
                  <div>
                    <h2>Tareas abiertas</h2>
                    <p>
                      {taskStats.doneToday} hecha
                      {taskStats.doneToday === 1 ? '' : 's'} hoy
                    </p>
                  </div>
                  <Link to="/tareas" className="home-card__link">
                    Ver tareas
                  </Link>
                </header>
                <div className="home-card__kpis">
                  <div className="home-kpi home-kpi--warn">
                    <strong>{taskStats.overdue}</strong>
                    <span>Vencidas</span>
                  </div>
                  <div className="home-kpi">
                    <strong>{taskStats.dueToday}</strong>
                    <span>Vencen hoy</span>
                  </div>
                  <div className="home-kpi home-kpi--progress">
                    <strong>{taskStats.progress}</strong>
                    <span>En progreso</span>
                  </div>
                  <div className="home-kpi">
                    <strong>{taskStats.pending}</strong>
                    <span>Pendientes</span>
                  </div>
                </div>
                {taskStats.preview.length > 0 ? (
                  <div className="home-card__list">
                    <h3>Por atender</h3>
                    <ul className="home-task-list">
                      {taskStats.preview.map((task) => {
                        const due = limaDayOf(task.dueDate)
                        const overdue = Boolean(due && due < todayKey)
                        const dueToday = due === todayKey
                        return (
                          <li key={task.id}>
                            <strong>{task.title}</strong>
                            <span>
                              {taskStatusLabel(task.status)}
                              {overdue
                                ? ' · vencida'
                                : dueToday
                                  ? ' · vence hoy'
                                  : ''}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    {taskStats.extra > 0 ? (
                      <p className="home-card__more">
                        +{taskStats.extra} más en Tareas
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="home-card__ok">No hay tareas abiertas.</p>
                )}
              </article>
            ) : null}
          </div>

          {hasAttention ? (
            <article className="home-card home-card--alerts">
              <header className="home-card__head">
                <div>
                  <h2>Pendiente de atender</h2>
                  <p>Avisos que no son del día, pero sí hay que resolver.</p>
                </div>
              </header>
              <div className="home-alerts">
                {withoutRole.count > 0 ? (
                  <div className="home-alert">
                    <div>
                      <strong>
                        {withoutRole.count} persona
                        {withoutRole.count === 1 ? '' : 's'} sin rol
                      </strong>
                      <p>
                        {withoutRole.names.join(', ')}
                        {withoutRole.extra > 0
                          ? ` y ${withoutRole.extra} más`
                          : ''}
                      </p>
                    </div>
                    <Link to="/recursos-humanos" className="home-card__link">
                      Recursos Humanos
                    </Link>
                  </div>
                ) : null}
                {openTickets.count > 0 ? (
                  <div className="home-alert">
                    <div>
                      <strong>
                        {openTickets.count} aviso
                        {openTickets.count === 1 ? '' : 's'} de soporte
                      </strong>
                      <ul>
                        {openTickets.preview.map((ticket) => (
                          <li key={ticket.id}>
                            {supportTicketKindLabel(ticket.kind)} · {ticket.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link to="/soporte" className="home-card__link">
                      Soporte
                    </Link>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}

          {!showAttendance && !showTasks && !hasAttention ? (
            <p className="home-page__empty">
              No hay un resumen para tus menús. Entra por el lateral a cada
              módulo.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
