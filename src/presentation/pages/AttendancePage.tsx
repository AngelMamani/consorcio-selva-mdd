import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { saveAs } from 'file-saver'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Swal from 'sweetalert2'
import {
  AttendanceOrigin,
  attendanceHasGpsPin,
  attendanceOriginLabel,
  clipDateKeysToToday,
  formatAttendanceDayLabel,
  formatAttendanceTime,
  limaMonthRange,
  limaWeekRange,
  toLimaDateKey,
  type Attendance,
} from '@/domain/entities/Attendance'
import type { AttendancePermissionRequest } from '@/domain/entities/AttendancePermissionRequest'
import {
  MAX_LEAVE_DAYS,
  MIN_LEAVE_DAYS,
} from '@/domain/entities/AttendancePermissionRequest'
import {
  MAX_OFFICE_RADIUS_METERS,
  MIN_OFFICE_RADIUS_METERS,
  MAX_OFFICE_POINTS,
  defaultOfficePoint,
  resolveOfficePoints,
  type AttendanceOfficePoint,
  type AttendanceSettings,
} from '@/domain/entities/AttendanceSettings'
import type {
  AttendanceDayRow,
  AttendancePeriodRow,
} from '@/domain/usecases/attendance/AttendanceUseCases'
import { DomainError } from '@/domain/errors/DomainError'
import { userAccessDni } from '@/domain/entities/User'
import { canManageUsers, userRoleLabel } from '@/domain/value-objects/UserRole'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import {
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

type AttendancePeriod = 'day' | 'week' | 'month'

function statusClass(
  attendance: AttendanceDayRow['attendance'],
): 'is-office' | 'is-zone' | 'is-permiso' | 'is-missing' {
  if (!attendance) return 'is-missing'
  if (attendance.origin === AttendanceOrigin.Oficina) return 'is-office'
  if (attendance.origin === AttendanceOrigin.Permiso) return 'is-permiso'
  return 'is-zone'
}

function periodDateKeys(
  period: AttendancePeriod,
  dateKey: string,
  todayKey: string,
): string[] {
  if (period === 'week') {
    return clipDateKeysToToday(limaWeekRange(dateKey).dateKeys, todayKey)
  }
  if (period === 'month') {
    return clipDateKeysToToday(limaMonthRange(dateKey).dateKeys, todayKey)
  }
  return [dateKey]
}

function periodRangeLabel(
  period: AttendancePeriod,
  dateKeys: string[],
): string {
  const first = dateKeys[0]
  const last = dateKeys[dateKeys.length - 1] ?? first
  if (!first) return ''
  if (period === 'day') return formatAttendanceDayLabel(first)
  if (period === 'week') {
    return `Lunes a domingo · ${formatAttendanceDayLabel(first)} – ${formatAttendanceDayLabel(last)}`
  }
  const parts = first.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const label = new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString(
    'es-PE',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function cellShortLabel(attendance: Attendance | null): string {
  if (!attendance) return '—'
  if (attendance.origin === AttendanceOrigin.Oficina) return 'Oficina'
  if (attendance.origin === AttendanceOrigin.Permiso) return 'Permiso'
  return 'Campo'
}

function dayHeaderParts(dateKey: string): { dow: string; day: string } {
  const parts = dateKey.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return {
    dow: date
      .toLocaleDateString('es-PE', { weekday: 'short', timeZone: 'UTC' })
      .replace('.', ''),
    day: String(day).padStart(2, '0'),
  }
}

export function AttendancePage() {
  const { user } = useAuth()
  const {
    listAttendancePeriodUseCase,
    getAttendanceSettingsUseCase,
    saveAttendanceSettingsUseCase,
    markAttendanceUseCase,
    listPendingAttendancePermissionRequestsUseCase,
    approveAttendancePermissionRequestUseCase,
    rejectAttendancePermissionRequestUseCase,
    exportAttendanceDayToExcelUseCase,
    exportAttendanceDayToPdfUseCase,
  } = useDependencies()

  const todayKey = toLimaDateKey()
  const [dateKey, setDateKey] = useState(todayKey)
  const [period, setPeriod] = useState<AttendancePeriod>('day')
  const [periodRows, setPeriodRows] = useState<AttendancePeriodRow[]>([])
  const [settings, setSettings] = useState<AttendanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [originFilter, setOriginFilter] = useState<
    'all' | 'oficina' | 'zona' | 'permiso' | 'sin'
  >('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'map'>('table')
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [marking, setMarking] = useState<'oficina' | 'zona' | null>(null)
  const [pendingRequests, setPendingRequests] = useState<
    AttendancePermissionRequest[]
  >([])
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(
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

  const periodKeys = useMemo(
    () => periodDateKeys(period, dateKey, todayKey),
    [period, dateKey, todayKey],
  )
  const rows: AttendanceDayRow[] = useMemo(
    () =>
      periodRows.map((row) => ({
        person: row.person,
        attendance: row.byDate[dateKey] ?? null,
      })),
    [periodRows, dateKey],
  )
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
      const keys = periodDateKeys(period, nextDate, todayKey)
      const [nextPeriodRows, nextSettings, pending] = await Promise.all([
        listAttendancePeriodUseCase.execute(user, keys),
        getAttendanceSettingsUseCase.execute(user),
        canManageUsers(user.role)
          ? listPendingAttendancePermissionRequestsUseCase.execute(user)
          : Promise.resolve([] as AttendancePermissionRequest[]),
      ])
      setPeriodRows(nextPeriodRows)
      setSettings(nextSettings)
      setPendingRequests(pending)
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
  }, [user?.id, dateKey, period])

  const filteredPeriodRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return periodRows.filter(({ person, byDate }) => {
      const dni = userAccessDni(person)
      const matchesSearch =
        !query ||
        person.displayName.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query) ||
        dni.includes(query) ||
        userRoleLabel(person.role).toLowerCase().includes(query)
      if (!matchesSearch) return false
      const marks = periodKeys.map((key) => byDate[key] ?? null)
      if (originFilter === 'oficina') {
        return marks.some((item) => item?.origin === AttendanceOrigin.Oficina)
      }
      if (originFilter === 'zona') {
        return marks.some((item) => item?.origin === AttendanceOrigin.Zona)
      }
      if (originFilter === 'permiso') {
        return marks.some((item) => item?.origin === AttendanceOrigin.Permiso)
      }
      if (originFilter === 'sin') return marks.every((item) => item == null)
      return true
    })
  }, [periodRows, periodKeys, search, originFilter])

  const filteredRows = useMemo(
    () =>
      filteredPeriodRows.map((row) => ({
        person: row.person,
        attendance: row.byDate[dateKey] ?? null,
      })),
    [filteredPeriodRows, dateKey],
  )

  const { presentOffice, presentZone, presentPermiso, missing } = useMemo(() => {
    let office = 0
    let zone = 0
    let permiso = 0
    let absent = 0
    for (const row of periodRows) {
      for (const key of periodKeys) {
        const mark = row.byDate[key] ?? null
        if (mark?.origin === AttendanceOrigin.Oficina) office += 1
        else if (mark?.origin === AttendanceOrigin.Zona) zone += 1
        else if (mark?.origin === AttendanceOrigin.Permiso) permiso += 1
        else absent += 1
      }
    }
    return {
      presentOffice: office,
      presentZone: zone,
      presentPermiso: permiso,
      missing: absent,
    }
  }, [periodRows, periodKeys])

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
    const result = await Swal.fire({
      icon: 'question',
      title: origin === 'oficina' ? '¿Marcar en oficina?' : '¿Marcar en campo?',
      html:
        'Se usará tu GPS. <strong>La foto de uniforme es opcional</strong> (cuerpo completo).',
      input: 'file',
      inputAttributes: {
        accept: 'image/*',
        capture: 'environment',
      },
      showCancelButton: true,
      showDenyButton: true,
      focusCancel: true,
      confirmButtonText: 'Marcar con foto',
      denyButtonText: 'Marcar sin foto',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1e88e5',
      denyButtonColor: '#2e7d32',
      cancelButtonColor: '#6b7385',
      reverseButtons: true,
      animation: false,
      preConfirm: (file) => {
        if (!file) {
          Swal.showValidationMessage(
            'Adjunta la foto o usa «Marcar sin foto»',
          )
          return false
        }
        return file as File
      },
    })
    if (result.isDismissed) return
    const file =
      result.isConfirmed && result.value instanceof File
        ? (result.value as File)
        : null
    if (result.isConfirmed && !file) return
    setMarking(origin)
    try {
      const location = await readBrowserLocation()
      await markAttendanceUseCase.execute(user, {
        origin:
          origin === 'oficina' ? AttendanceOrigin.Oficina : AttendanceOrigin.Zona,
        location,
        evidenceFile: file
          ? {
              data: file,
              contentType: file.type || 'image/jpeg',
            }
          : undefined,
      })
      swalSuccess(
        origin === 'oficina'
          ? file
            ? 'Asistencia de oficina marcada'
            : 'Asistencia de oficina marcada (sin foto)'
          : file
            ? 'Asistencia de campo marcada'
            : 'Asistencia de campo marcada (sin foto)',
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

  async function handleApproveRequest(item: AttendancePermissionRequest) {
    if (!user || reviewingRequestId) return
    const result = await Swal.fire({
      title: `Aprobar permiso · ${item.userName}`,
      html: `<p style="text-align:left;margin:0 0 10px">${escapeHtml(item.description)}</p>
        <label style="display:block;text-align:left;font-size:13px;margin-bottom:4px">Días de permiso</label>
        <input id="leave-days" type="number" min="${MIN_LEAVE_DAYS}" max="${MAX_LEAVE_DAYS}" value="1" class="swal2-input" style="margin:0 0 8px;width:100%" />
        <label style="display:block;text-align:left;font-size:13px;margin-bottom:4px">Fecha de inicio</label>
        <input id="leave-start" type="date" value="${todayKey}" class="swal2-input" style="margin:0;width:100%" />
        <label style="display:block;text-align:left;font-size:13px;margin:8px 0 4px">Nota admin (opcional)</label>
        <textarea id="leave-note" class="swal2-textarea" style="margin:0;width:100%" maxlength="200"></textarea>`,
      showCancelButton: true,
      focusCancel: true,
      confirmButtonText: 'Aprobar y asignar días',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e7d32',
      cancelButtonColor: '#6b7385',
      reverseButtons: true,
      animation: false,
      preConfirm: () => {
        const daysRaw = (
          document.getElementById('leave-days') as HTMLInputElement | null
        )?.value
        const start = (
          document.getElementById('leave-start') as HTMLInputElement | null
        )?.value
        const note = (
          document.getElementById('leave-note') as HTMLTextAreaElement | null
        )?.value
        const leaveDays = Number(daysRaw)
        if (
          !Number.isFinite(leaveDays) ||
          leaveDays < MIN_LEAVE_DAYS ||
          leaveDays > MAX_LEAVE_DAYS
        ) {
          Swal.showValidationMessage(
            `Los días deben estar entre ${MIN_LEAVE_DAYS} y ${MAX_LEAVE_DAYS}`,
          )
          return false
        }
        if (!start) {
          Swal.showValidationMessage('Elige la fecha de inicio')
          return false
        }
        return { leaveDays, startDateKey: start, adminNote: note ?? '' }
      },
    })
    if (!result.isConfirmed || !result.value) return
    const value = result.value as {
      leaveDays: number
      startDateKey: string
      adminNote: string
    }
    setReviewingRequestId(item.id)
    try {
      await approveAttendancePermissionRequestUseCase.execute(user, {
        requestId: item.id,
        leaveDays: value.leaveDays,
        startDateKey: value.startDateKey,
        adminNote: value.adminNote,
      })
      swalSuccess('Permiso aprobado y días asignados')
      await loadDay(dateKey)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo aprobar',
      )
    } finally {
      setReviewingRequestId(null)
    }
  }

  async function handleRejectRequest(item: AttendancePermissionRequest) {
    if (!user || reviewingRequestId) return
    const note = await swalPrompt({
      title: `Rechazar solicitud · ${item.userName}`,
      text: item.description,
      inputLabel: 'Motivo (opcional)',
      confirmButtonText: 'Rechazar',
    })
    if (note == null) return
    setReviewingRequestId(item.id)
    try {
      await rejectAttendancePermissionRequestUseCase.execute(user, {
        requestId: item.id,
        adminNote: note,
      })
      swalSuccess('Solicitud rechazada')
      await loadDay(dateKey)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo rechazar',
      )
    } finally {
      setReviewingRequestId(null)
    }
  }

  return (
    <section className="attendance-page">
      <header className="attendance-page__header">
        <div>
          <p className="attendance-page__eyebrow">
            {period === 'week'
              ? 'Control semanal'
              : period === 'month'
                ? 'Control mensual'
                : 'Control diario'}
          </p>
          <h2>Asistencias</h2>
          <p>
            Oficina o campo con GPS. Foto de uniforme opcional. Las solicitudes
            de permiso se hacen en el aplicativo; aquí solo se aceptan.
          </p>
          <p className="attendance-page__period-label">
            {periodRangeLabel(period, periodKeys)}
          </p>
        </div>
        <div className="attendance-page__toolbar">
          <div className="attendance-period" role="group" aria-label="Periodo">
            {(
              [
                ['day', 'Diario'],
                ['week', 'Semanal (lun–dom)'],
                ['month', 'Mensual'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={period === id ? 'is-active' : ''}
                onClick={() => setPeriod(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="attendance-date">
            <span>
              {period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Día'}
            </span>
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
          <span>{period === 'day' ? 'En oficina' : 'Marcas oficina'}</span>
        </article>
        <article className="attendance-kpi attendance-kpi--zone">
          <strong>{presentZone}</strong>
          <span>{period === 'day' ? 'En campo' : 'Marcas campo'}</span>
        </article>
        <article className="attendance-kpi attendance-kpi--permiso">
          <strong>{presentPermiso}</strong>
          <span>Permiso</span>
        </article>
        <article className="attendance-kpi attendance-kpi--missing">
          <strong>{missing}</strong>
          <span>{period === 'day' ? 'Sin marcar' : 'Días sin marca'}</span>
        </article>
        <article className="attendance-kpi">
          <strong>{periodRows.length}</strong>
          <span>Personas</span>
        </article>
      </div>

      {canSelfMark ? (
        <div className="attendance-self">
          <div>
            <strong>Tu marca de hoy</strong>
            <p>
              Oficina o campo con GPS. Foto de uniforme opcional.
            </p>
          </div>
          <div className="attendance-self__actions">
            <button
              type="button"
              className="btn btn--soft-primary"
              disabled={marking !== null}
              onClick={() => void handleSelfMark('oficina')}
            >
              {marking === 'oficina' ? 'Registrando...' : 'Estoy en oficina'}
            </button>
            <button
              type="button"
              className="btn btn--soft-teal"
              disabled={marking !== null}
              onClick={() => void handleSelfMark('zona')}
            >
              {marking === 'zona' ? 'Registrando...' : 'Estoy en campo'}
            </button>
          </div>
        </div>
      ) : null}

      {isAdmin && pendingRequests.length > 0 ? (
        <div className="attendance-permission-inbox">
          <strong>Solicitudes de permiso pendientes</strong>
          <ul>
            {pendingRequests.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.userName}</strong>
                  <p>{item.description}</p>
                  {item.evidencePhotoUrl ? (
                    <a
                      href={item.evidencePhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver foto
                    </a>
                  ) : null}
                </div>
                <div className="attendance-permission-inbox__actions">
                  <button
                    type="button"
                    className="btn btn--soft-teal"
                    disabled={reviewingRequestId !== null}
                    onClick={() => void handleApproveRequest(item)}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className="btn btn--soft-muted"
                    disabled={reviewingRequestId !== null}
                    onClick={() => void handleRejectRequest(item)}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
          {period === 'day' ? (
            <div className="attendance-view-toggle" role="group" aria-label="Vista">
              <button
                type="button"
                className={view === 'table' ? 'is-active' : ''}
                onClick={() => setView('table')}
              >
                Tabla
              </button>
              <button
                type="button"
                className={view === 'map' ? 'is-active' : ''}
                onClick={() => setView('map')}
              >
                Mapa
              </button>
            </div>
          ) : null}
        </div>

        {view === 'table' || period !== 'day' ? (
          <>
        <p className="attendance-table-caption">
          Tabla de asistencias
          {period === 'week'
            ? ' de lunes a domingo'
            : period === 'month'
              ? ' del mes'
              : ' del día'}
          .
          {period !== 'day'
            ? ' Toca una celda para ver ese día. El Excel y el PDF exportan el día del calendario.'
            : ''}
        </p>
        <div className="attendance-table-wrap">
          {loading ? (
            <p className="attendance-empty">Cargando asistencia...</p>
          ) : filteredPeriodRows.length === 0 ? (
            <p className="attendance-empty">No hay personas con ese filtro.</p>
          ) : (
            <table
              className={`attendance-table${period === 'month' ? ' attendance-table--month' : ''}`}
            >
              <thead>
                <tr>
                  <th className="attendance-table__person">Persona</th>
                  {periodKeys.map((key) => {
                    const header = dayHeaderParts(key)
                    return (
                      <th
                        key={key}
                        className={key === todayKey ? 'is-today' : undefined}
                      >
                        <span className="attendance-table__dow">{header.dow}</span>
                        <span className="attendance-table__num">{header.day}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredPeriodRows.map(({ person, byDate }) => {
                  const dni = userAccessDni(person)
                  return (
                    <tr key={person.id}>
                      <th scope="row" className="attendance-table__person">
                        <strong>{person.displayName}</strong>
                        <span>
                          {userRoleLabel(person.role)}
                          {dni ? ` · ${dni}` : ''}
                        </span>
                      </th>
                      {periodKeys.map((key) => {
                        const attendance = byDate[key] ?? null
                        const cellClass = statusClass(attendance)
                        return (
                          <td
                            key={key}
                            className={key === todayKey ? 'is-today' : undefined}
                          >
                            <button
                              type="button"
                              className={`attendance-table__cell ${cellClass}`}
                              title={
                                attendance
                                  ? `${attendanceOriginLabel(attendance.origin)} · ${formatAttendanceTime(attendance.createdAt)}`
                                  : 'Sin marcar'
                              }
                              onClick={() => {
                                if (period !== 'day') {
                                  setDateKey(key)
                                  setPeriod('day')
                                  setView('table')
                                }
                              }}
                            >
                              {cellShortLabel(attendance)}
                            </button>
                            {period === 'day' && attendance ? (
                              <div className="attendance-table__meta">
                                <span>{formatAttendanceTime(attendance.createdAt)}</span>
                                {attendance.areaName ? (
                                  <span>{attendance.areaName}</span>
                                ) : null}
                                {attendance.environmentPhotoUrl ? (
                                  <a
                                    href={attendance.environmentPhotoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Foto
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
          </>
        ) : null}
        <div
          className={`attendance-map-panel${period === 'day' && view === 'map' ? ' is-visible' : ''}`}
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
