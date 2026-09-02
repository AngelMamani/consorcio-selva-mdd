import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { saveAs } from 'file-saver'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AttendanceOrigin,
  attendanceHasGpsPin,
  attendanceOriginLabel,
  formatAttendanceTime,
  toLimaDateKey,
} from '@/domain/entities/Attendance'
import {
  MAX_OFFICE_RADIUS_METERS,
  MIN_OFFICE_RADIUS_METERS,
  MAX_OFFICE_POINTS,
  defaultOfficePoint,
  resolveOfficePoints,
  type AttendanceOfficePoint,
  type AttendanceSettings,
} from '@/domain/entities/AttendanceSettings'
import type { AttendanceDayRow } from '@/domain/usecases/attendance/AttendanceUseCases'
import { DomainError } from '@/domain/errors/DomainError'
import { userAccessDni } from '@/domain/entities/User'
import { canManageUsers, userRoleLabel } from '@/domain/value-objects/UserRole'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
  swalConfirm,
  swalError,
  swalPrompt,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import './AttendancePage.css'

function attendanceLoadMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code === 'permission-denied') {
    return 'No tienes permiso para ver asistencias. Recarga e intenta de nuevo.'
  }
  if (code === 'failed-precondition') {
    return 'La consulta de asistencia se está preparando. Recarga en unos segundos.'
  }
  return 'No se pudo cargar la asistencia'
}

const OFFICE_POINT_COLORS = [
  '#1565C0',
  '#6A1B9A',
  '#00897B',
  '#EF6C00',
  '#5D4037',
  '#455A64',
]

function officePointColor(index: number): string {
  return OFFICE_POINT_COLORS[index % OFFICE_POINT_COLORS.length]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'map-route-marker',
    html: `<span class="map-route-marker__pin" style="--pin-color:${color}">
      <svg viewBox="0 0 24 36" aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="var(--pin-color)" stroke="#fff" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="4.2" fill="#fff"/>
      </svg>
    </span>`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -36],
  })
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function readBrowserLocation(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new DomainError('Este navegador no puede leer el GPS'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        })
      },
      () => {
        reject(
          new DomainError(
            'No se pudo leer el GPS. Permite la ubicación en el navegador.',
          ),
        )
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

function statusClass(
  attendance: AttendanceDayRow['attendance'],
): 'is-office' | 'is-zone' | 'is-permiso' | 'is-missing' {
  if (!attendance) return 'is-missing'
  if (attendance.origin === AttendanceOrigin.Oficina) return 'is-office'
  if (attendance.origin === AttendanceOrigin.Permiso) return 'is-permiso'
  return 'is-zone'
}

export function AttendancePage() {
  const { user } = useAuth()
  const {
    listAttendanceDayUseCase,
    getAttendanceSettingsUseCase,
    saveAttendanceSettingsUseCase,
    markAttendanceUseCase,
    grantAttendancePermissionUseCase,
    exportAttendanceDayToExcelUseCase,
    exportAttendanceDayToPdfUseCase,
  } = useDependencies()

  const todayKey = toLimaDateKey()
  const [dateKey, setDateKey] = useState(todayKey)
  const [rows, setRows] = useState<AttendanceDayRow[]>([])
  const [settings, setSettings] = useState<AttendanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [originFilter, setOriginFilter] = useState<
    'all' | 'oficina' | 'zona' | 'permiso' | 'sin'
  >('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'people' | 'map'>('people')
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [marking, setMarking] = useState<'oficina' | 'zona' | 'permiso' | null>(
    null,
  )
  const [officePointsForm, setOfficePointsForm] = useState<AttendanceOfficePoint[]>(
    [],
  )
  const [selectedPointId, setSelectedPointId] = useState('')

  const mapRef = useRef<L.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const settingsMapRef = useRef<L.Map | null>(null)
  const settingsMapElRef = useRef<HTMLDivElement | null>(null)
  const settingsMarkerRef = useRef<L.Marker | null>(null)
  const settingsCircleRef = useRef<L.Circle | null>(null)

  const isAdmin = Boolean(user && canManageUsers(user.role))
  const isToday = dateKey === todayKey
  const ownRow = rows.find((row) => row.person.id === user?.id)
  const officePoints = useMemo(
    () => (settings ? resolveOfficePoints(settings) : []),
    [settings],
  )
  const selectedPoint =
    officePointsForm.find((point) => point.id === selectedPointId) ??
    officePointsForm[0] ??
    null
  const canSelfMark = isToday && Boolean(user) && !ownRow?.attendance && !loading

  function syncOfficePointsForm(points: AttendanceOfficePoint[]) {
    setOfficePointsForm(points)
    setSelectedPointId((current) =>
      points.some((point) => point.id === current)
        ? current
        : (points[0]?.id ?? ''),
    )
  }

  function updateSelectedPoint(patch: Partial<AttendanceOfficePoint>) {
    if (!selectedPointId) return
    setOfficePointsForm((prev) =>
      prev.map((point) =>
        point.id === selectedPointId ? { ...point, ...patch } : point,
      ),
    )
  }

  function addOfficePoint() {
    if (officePointsForm.length >= MAX_OFFICE_POINTS) return
    const point = defaultOfficePoint({
      name: `Punto ${officePointsForm.length + 1}`,
      latitude:
        selectedPoint?.latitude ??
        officePointsForm[officePointsForm.length - 1]?.latitude ??
        -12.59331,
      longitude:
        selectedPoint?.longitude ??
        officePointsForm[officePointsForm.length - 1]?.longitude ??
        -69.18915,
    })
    setOfficePointsForm((prev) => [...prev, point])
    setSelectedPointId(point.id)
  }

  function removeOfficePoint(pointId: string) {
    if (officePointsForm.length <= 1) return
    setOfficePointsForm((prev) => {
      const next = prev.filter((point) => point.id !== pointId)
      setSelectedPointId((current) =>
        current === pointId ? (next[0]?.id ?? '') : current,
      )
      return next
    })
  }

  async function loadDay(nextDate = dateKey) {
    if (!user) return
    setLoading(true)
    try {
      const [dayRows, nextSettings] = await Promise.all([
        listAttendanceDayUseCase.execute(user, nextDate),
        getAttendanceSettingsUseCase.execute(user),
      ])
      setRows(dayRows)
      setSettings(nextSettings)
      syncOfficePointsForm(resolveOfficePoints(nextSettings))
    } catch (err) {
      swalError(attendanceLoadMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDay(dateKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dateKey])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter(({ person, attendance }) => {
      const dni = userAccessDni(person)
      const matchesSearch =
        !query ||
        person.displayName.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query) ||
        dni.includes(query) ||
        userRoleLabel(person.role).toLowerCase().includes(query)
      if (!matchesSearch) return false
      if (originFilter === 'oficina') {
        return attendance?.origin === AttendanceOrigin.Oficina
      }
      if (originFilter === 'zona') {
        return attendance?.origin === AttendanceOrigin.Zona
      }
      if (originFilter === 'permiso') {
        return attendance?.origin === AttendanceOrigin.Permiso
      }
      if (originFilter === 'sin') return attendance == null
      return true
    })
  }, [rows, search, originFilter])

  const presentOffice = rows.filter(
    (row) => row.attendance?.origin === AttendanceOrigin.Oficina,
  ).length
  const presentZone = rows.filter(
    (row) => row.attendance?.origin === AttendanceOrigin.Zona,
  ).length
  const presentPermiso = rows.filter(
    (row) => row.attendance?.origin === AttendanceOrigin.Permiso,
  ).length
  const missing = rows.filter((row) => row.attendance == null).length

  useEffect(() => {
    const el = mapElRef.current
    if (!el) return

    const map = L.map(el, {
      center: [-12.5933, -69.1891],
      zoom: 12,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const refresh = () => map.invalidateSize({ animate: false })
    const resizeObserver = new ResizeObserver(refresh)
    resizeObserver.observe(el)
    window.addEventListener('resize', refresh)
    window.setTimeout(refresh, 80)
    window.setTimeout(refresh, 320)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', refresh)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (view !== 'map') return
    const map = mapRef.current
    if (!map) return
    window.setTimeout(() => map.invalidateSize({ animate: false }), 50)
    window.setTimeout(() => map.invalidateSize({ animate: false }), 280)
  }, [view])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer || officePoints.length === 0) return
    layer.clearLayers()

    const bounds: L.LatLngExpression[] = []

    officePoints.forEach((point, index) => {
      const color = officePointColor(index)
      const latLng: L.LatLngExpression = [point.latitude, point.longitude]
      bounds.push(latLng)
      L.circle(latLng, {
        radius: point.radiusMeters,
        color,
        fillColor: color,
        fillOpacity: 0.16,
        weight: 2,
      }).addTo(layer)
      L.marker(latLng, {
        icon: pinIcon(color),
        title: point.name,
      })
        .bindPopup(
          `<strong>${escapeHtml(point.name)}</strong><br/>Radio ${point.radiusMeters} m`,
        )
        .addTo(layer)
    })

    for (const { person, attendance } of filteredRows) {
      if (!attendance || !attendanceHasGpsPin(attendance)) continue
      const color =
        attendance.origin === AttendanceOrigin.Oficina
          ? officePointColor(
              Math.max(
                0,
                officePoints.findIndex((point) => point.id === attendance.areaId),
              ),
            )
          : '#2E7D32'
      const latLng: L.LatLngExpression = [
        attendance.latitude,
        attendance.longitude,
      ]
      bounds.push(latLng)
      const photo = attendance.environmentPhotoUrl
        ? `<br/><img src="${escapeHtml(attendance.environmentPhotoUrl)}" alt="" style="width:160px;height:110px;object-fit:cover;border-radius:8px;margin-top:6px" />`
        : ''
      const officeLabel =
        attendance.origin === AttendanceOrigin.Oficina && attendance.areaName
          ? `<br/>${escapeHtml(attendance.areaName)}`
          : ''
      L.marker(latLng, { icon: pinIcon(color), title: person.displayName })
        .bindPopup(
          `<strong>${escapeHtml(person.displayName)}</strong><br/>` +
            `${escapeHtml(attendanceOriginLabel(attendance.origin))}` +
            ` · ${formatAttendanceTime(attendance.createdAt)}` +
            officeLabel +
            photo,
        )
        .addTo(layer)
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 18)
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 17 })
    }
    window.setTimeout(() => map.invalidateSize({ animate: false }), 80)
  }, [filteredRows, officePoints, view])

  useEffect(() => {
    if (!showSettings || !settingsMapElRef.current || !selectedPoint) return
    const map = L.map(settingsMapElRef.current, {
      center: [selectedPoint.latitude, selectedPoint.longitude],
      zoom: 19,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    settingsMarkerRef.current = L.marker(
      [selectedPoint.latitude, selectedPoint.longitude],
      { icon: pinIcon('#1565C0'), draggable: true },
    ).addTo(map)
    settingsCircleRef.current = L.circle(
      [selectedPoint.latitude, selectedPoint.longitude],
      {
        radius: selectedPoint.radiusMeters,
        color: '#1565C0',
        fillOpacity: 0.1,
      },
    ).addTo(map)
    settingsMapRef.current = map

    function applyPoint(lat: number, lng: number) {
      updateSelectedPoint({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      })
    }

    map.on('click', (event: L.LeafletMouseEvent) => {
      applyPoint(event.latlng.lat, event.latlng.lng)
    })
    settingsMarkerRef.current.on('dragend', () => {
      const pos = settingsMarkerRef.current?.getLatLng()
      if (pos) applyPoint(pos.lat, pos.lng)
    })

    window.setTimeout(() => map.invalidateSize(), 180)

    return () => {
      map.remove()
      settingsMapRef.current = null
      settingsMarkerRef.current = null
      settingsCircleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSettings, selectedPointId])

  useEffect(() => {
    const marker = settingsMarkerRef.current
    const circle = settingsCircleRef.current
    const map = settingsMapRef.current
    if (!marker || !circle || !map || !selectedPoint) return
    const latLng: L.LatLngExpression = [
      selectedPoint.latitude,
      selectedPoint.longitude,
    ]
    marker.setLatLng(latLng)
    circle.setLatLng(latLng)
    circle.setRadius(selectedPoint.radiusMeters)
    map.panTo(latLng, { animate: false })
  }, [
    selectedPoint?.latitude,
    selectedPoint?.longitude,
    selectedPoint?.radiusMeters,
  ])

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault()
    if (!user || savingSettings) return
    setSavingSettings(true)
    try {
      const saved = await saveAttendanceSettingsUseCase.execute(user, {
        officePoints: officePointsForm,
      })
      setSettings(saved)
      syncOfficePointsForm(resolveOfficePoints(saved))
      setShowSettings(false)
      swalSuccess('Puntos de oficina actualizados')
    } catch (err) {
      swalError(err instanceof DomainError ? err.message : 'No se pudo guardar')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleExportExcel() {
    if (!user || exporting) return
    setExporting('excel')
    try {
      const file = await exportAttendanceDayToExcelUseCase.execute(user, dateKey)
      saveAs(file.blob, file.fileName)
      swalSuccess('Excel de asistencia descargado')
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
      const file = await exportAttendanceDayToPdfUseCase.execute(user, dateKey)
      saveAs(file.blob, file.fileName)
      swalSuccess('PDF de evidencia descargado')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo exportar el PDF',
      )
    } finally {
      setExporting(null)
    }
  }

  async function handleSelfMark(origin: 'oficina' | 'zona') {
    if (!user || marking) return
    const confirmed = await swalConfirm({
      title: origin === 'oficina' ? '¿Marcar en oficina?' : '¿Marcar en campo?',
      text:
        origin === 'oficina'
          ? 'Se usará tu GPS. Debes estar dentro del radio de un punto de oficina autorizado.'
          : 'Se usará tu GPS para registrar que estás en campo.',
      confirmButtonText: 'Marcar ahora',
    })
    if (!confirmed) return
    setMarking(origin)
    try {
      const location = await readBrowserLocation()
      await markAttendanceUseCase.execute(user, {
        origin:
          origin === 'oficina' ? AttendanceOrigin.Oficina : AttendanceOrigin.Zona,
        location,
      })
      swalSuccess(
        origin === 'oficina' ? 'Asistencia de oficina marcada' : 'Asistencia de campo marcada',
      )
      await loadDay(dateKey)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo marcar la asistencia',
      )
    } finally {
      setMarking(null)
    }
  }

  async function handleGrantPermiso(targetUserId: string, targetName: string) {
    if (!user || marking) return
    const note = await swalPrompt({
      title: `Permiso para ${targetName}`,
      text: 'Queda registrado para este día, sin GPS.',
      inputLabel: 'Motivo (opcional)',
      inputPlaceholder: 'Ej. Descanso médico, comisión',
      confirmButtonText: 'Registrar permiso',
    })
    if (note == null) return
    setMarking('permiso')
    try {
      await grantAttendancePermissionUseCase.execute(user, {
        targetUserId,
        dateKey,
        note,
      })
      swalSuccess('Permiso registrado')
      await loadDay(dateKey)
    } catch (err) {
      swalError(err instanceof DomainError ? err.message : 'No se pudo registrar')
    } finally {
      setMarking(null)
    }
  }

  return (
    <section className="attendance-page">
      <header className="attendance-page__header">
        <div>
          <p className="attendance-page__eyebrow">Control diario</p>
          <h2>Asistencias</h2>
          <p>
            Oficina con GPS en puntos autorizados. Campo con GPS. Los permisos
            solo los registra un administrador.
          </p>
        </div>
        <div className="attendance-page__toolbar">
          <label className="attendance-date">
            <span>Día</span>
            <input
              type="date"
              value={dateKey}
              max={todayKey}
              onChange={(event) => setDateKey(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--soft-muted"
            onClick={() => void handleExportExcel()}
            disabled={loading || exporting !== null}
          >
            {exporting === 'excel' ? 'Generando Excel...' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            className="btn btn--soft-teal"
            onClick={() => void handleExportPdf()}
            disabled={loading || exporting !== null}
          >
            {exporting === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="btn btn--soft-primary"
              onClick={() => {
                if (settings) {
                  syncOfficePointsForm(resolveOfficePoints(settings))
                }
                setShowSettings(true)
              }}
            >
              Configurar puntos de oficina
            </button>
          ) : null}
        </div>
      </header>

      <div className="attendance-kpis">
        <article className="attendance-kpi attendance-kpi--office">
          <strong>{presentOffice}</strong>
          <span>En oficina</span>
        </article>
        <article className="attendance-kpi attendance-kpi--zone">
          <strong>{presentZone}</strong>
          <span>En campo</span>
        </article>
        <article className="attendance-kpi attendance-kpi--permiso">
          <strong>{presentPermiso}</strong>
          <span>Permiso</span>
        </article>
        <article className="attendance-kpi attendance-kpi--missing">
          <strong>{missing}</strong>
          <span>Sin marcar</span>
        </article>
        <article className="attendance-kpi">
          <strong>{rows.length}</strong>
          <span>Personas</span>
        </article>
      </div>

      {canSelfMark ? (
        <div className="attendance-self">
          <div>
            <strong>Tu marca de hoy</strong>
            <p>Elige oficina o campo. Una sola vez al día. Para permiso, contacta a un administrador.</p>
          </div>
          <div className="attendance-self__actions">
            <button
              type="button"
              className="btn btn--soft-primary"
              disabled={marking !== null}
              onClick={() => void handleSelfMark('oficina')}
            >
              {marking === 'oficina' ? 'Leyendo GPS...' : 'Estoy en oficina'}
            </button>
            <button
              type="button"
              className="btn btn--soft-teal"
              disabled={marking !== null}
              onClick={() => void handleSelfMark('zona')}
            >
              {marking === 'zona' ? 'Leyendo GPS...' : 'Estoy en campo'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="attendance-board">
        <div className="attendance-board__bar">
          <label className="field attendance-board__search">
            <span>Buscar</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, DNI o rol"
            />
          </label>
          <div className="attendance-chips" role="group" aria-label="Filtro">
            {(
              [
                ['all', 'Todos'],
                ['oficina', 'Oficina'],
                ['zona', 'Campo'],
                ['permiso', 'Permiso'],
                ['sin', 'Sin marcar'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={originFilter === id ? 'is-active' : ''}
                onClick={() => setOriginFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="attendance-view-toggle" role="group" aria-label="Vista">
            <button
              type="button"
              className={view === 'people' ? 'is-active' : ''}
              onClick={() => setView('people')}
            >
              Personas
            </button>
            <button
              type="button"
              className={view === 'map' ? 'is-active' : ''}
              onClick={() => setView('map')}
            >
              Mapa
            </button>
          </div>
        </div>

        <div
          className={`attendance-people-wrap${view === 'people' ? ' is-visible' : ''}`}
        >
            {loading ? (
              <p className="attendance-empty">Cargando asistencia...</p>
            ) : filteredRows.length === 0 ? (
              <p className="attendance-empty">No hay personas con ese filtro.</p>
            ) : (
              <ul className="attendance-people">
                {filteredRows.map(({ person, attendance }) => {
                  const dni = userAccessDni(person)
                  return (
                    <li key={person.id} className="attendance-card">
                      <div className="attendance-card__top">
                        <div className="attendance-row__avatar" aria-hidden="true">
                          {initials(person.displayName)}
                        </div>
                        <div className="attendance-card__copy">
                          <strong>{person.displayName}</strong>
                          <span>
                            {userRoleLabel(person.role)}
                            {dni ? ` · DNI ${dni}` : ''}
                          </span>
                        </div>
                        <em className={statusClass(attendance)}>
                          {attendance
                            ? attendanceOriginLabel(attendance.origin)
                            : 'Sin marcar'}
                        </em>
                      </div>
                      <div className="attendance-card__meta">
                        {attendance ? (
                          <>
                            <span>
                              {attendance.origin === AttendanceOrigin.Permiso
                                ? 'Registrado'
                                : 'Marcó'}{' '}
                              a las {formatAttendanceTime(attendance.createdAt)}
                            </span>
                            {attendance.origin === AttendanceOrigin.Oficina &&
                            attendance.areaName ? (
                              <span>{attendance.areaName}</span>
                            ) : null}
                            {attendance.permissionNote ? (
                              <span>{attendance.permissionNote}</span>
                            ) : null}
                            {attendance.environmentPhotoUrl ? (
                              <a
                                href={attendance.environmentPhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ver foto
                              </a>
                            ) : null}
                          </>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            className="attendance-card__permiso"
                            disabled={marking !== null}
                            onClick={() =>
                              void handleGrantPermiso(person.id, person.displayName)
                            }
                          >
                            Dar permiso
                          </button>
                        ) : (
                          <span>Aún no marca</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        <div
          className={`attendance-map-panel${view === 'map' ? ' is-visible' : ''}`}
        >
          <p className="attendance-map-caption">
            Círculos: puntos de oficina autorizados. Verde: marcas en campo.
          </p>
          <div ref={mapElRef} className="attendance-map" />
        </div>
      </div>

      <AppModal
        open={showSettings}
        title="Puntos de oficina"
        description="Agrega sedes personalizadas (ej. Oficina de Cobranza). Toca el mapa o arrastra el pin del punto seleccionado."
        onClose={() => {
          if (!savingSettings) setShowSettings(false)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setShowSettings(false)}
              disabled={savingSettings}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="office-settings-form"
              className="btn btn--soft-primary"
              disabled={savingSettings}
            >
              {savingSettings ? 'Guardando...' : 'Guardar puntos'}
            </button>
          </>
        }
      >
        <form
          id="office-settings-form"
          className="login-form attendance-office-form"
          onSubmit={handleSaveSettings}
        >
          <div className="attendance-office-list">
            <div className="attendance-office-list__head">
              <strong>Puntos configurados</strong>
              <button
                type="button"
                className="btn btn--soft-primary"
                disabled={officePointsForm.length >= MAX_OFFICE_POINTS}
                onClick={addOfficePoint}
              >
                Agregar punto
              </button>
            </div>
            <ul>
              {officePointsForm.map((point, index) => (
                <li key={point.id}>
                  <button
                    type="button"
                    className={
                      point.id === selectedPointId ? 'is-active' : undefined
                    }
                    onClick={() => setSelectedPointId(point.id)}
                  >
                    <span
                      className="attendance-office-list__dot"
                      style={{ background: officePointColor(index) }}
                    />
                    {point.name}
                  </button>
                  <button
                    type="button"
                    className="attendance-office-list__remove"
                    disabled={officePointsForm.length <= 1}
                    onClick={() => removeOfficePoint(point.id)}
                    aria-label={`Quitar ${point.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {selectedPoint ? (
            <>
              <label className="field">
                <span>Nombre del punto</span>
                <input
                  value={selectedPoint.name}
                  onChange={(event) =>
                    updateSelectedPoint({ name: event.target.value })
                  }
                  required
                  maxLength={120}
                  placeholder="Ej. Oficina de Cobranza"
                />
              </label>
              <div ref={settingsMapElRef} className="attendance-settings-map" />
              <div className="attendance-settings-grid">
                <label className="field">
                  <span>Latitud</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={selectedPoint.latitude}
                    onChange={(event) =>
                      updateSelectedPoint({
                        latitude: Number(event.target.value),
                      })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Longitud</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={selectedPoint.longitude}
                    onChange={(event) =>
                      updateSelectedPoint({
                        longitude: Number(event.target.value),
                      })
                    }
                    required
                  />
                </label>
              </div>
              <label className="field">
                <span>Radio permitido: {selectedPoint.radiusMeters} m</span>
                <input
                  type="range"
                  min={MIN_OFFICE_RADIUS_METERS}
                  max={MAX_OFFICE_RADIUS_METERS}
                  step={1}
                  value={selectedPoint.radiusMeters}
                  onChange={(event) =>
                    updateSelectedPoint({
                      radiusMeters: Number(event.target.value),
                    })
                  }
                />
              </label>
            </>
          ) : null}
        </form>
      </AppModal>
    </section>
  )
}
