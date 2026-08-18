import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { saveAs } from 'file-saver'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AttendanceOrigin,
  attendanceOriginLabel,
  formatAttendanceTime,
  toLimaDateKey,
} from '@/domain/entities/Attendance'
import {
  MAX_OFFICE_RADIUS_METERS,
  MIN_OFFICE_RADIUS_METERS,
  type AttendanceSettings,
} from '@/domain/entities/AttendanceSettings'
import type { AttendanceOfficeQr } from '@/domain/entities/AttendanceOfficeQr'
import type { AttendanceDayRow } from '@/domain/usecases/attendance/AttendanceUseCases'
import { DomainError } from '@/domain/errors/DomainError'
import { UserRole } from '@/domain/value-objects/UserRole'
import { formatDateKey } from '@/domain/entities/FolderDate'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { AppModal } from '@/presentation/components/AppModal'
import { swalConfirm, swalError, swalSuccess } from '@/presentation/utils/appSwal'
import QRCode from 'react-qr-code'
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

const OFFICE_COLOR = '#1565C0'
const ZONE_COLOR = '#2E7D32'

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

export function AttendancePage() {
  const { user } = useAuth()
  const {
    listAttendanceDayUseCase,
    getAttendanceSettingsUseCase,
    saveAttendanceSettingsUseCase,
    getOrCreateTodayOfficeQrUseCase,
    rotateTodayOfficeQrUseCase,
    exportAttendanceDayToExcelUseCase,
    exportAttendanceDayToPdfUseCase,
  } = useDependencies()

  const [dateKey] = useState(toLimaDateKey())
  const [rows, setRows] = useState<AttendanceDayRow[]>([])
  const [settings, setSettings] = useState<AttendanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [originFilter, setOriginFilter] = useState<'all' | 'oficina' | 'zona' | 'sin'>('all')
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const [qrKiosk, setQrKiosk] = useState(false)
  const [officeQr, setOfficeQr] = useState<AttendanceOfficeQr | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [officeForm, setOfficeForm] = useState({
    officeName: '',
    officeLatitude: 0,
    officeLongitude: 0,
    officeRadiusMeters: 10,
  })

  const mapRef = useRef<L.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const settingsMapRef = useRef<L.Map | null>(null)
  const settingsMapElRef = useRef<HTMLDivElement | null>(null)
  const settingsMarkerRef = useRef<L.Marker | null>(null)
  const settingsCircleRef = useRef<L.Circle | null>(null)

  const isAdmin = user?.role === UserRole.Administrador

  async function loadOfficeQr() {
    if (!user) return
    setLoadingQr(true)
    try {
      const nextQr = await getOrCreateTodayOfficeQrUseCase.execute(user)
      setOfficeQr(nextQr)
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo generar el QR de oficina',
      )
    } finally {
      setLoadingQr(false)
    }
  }

  async function openOfficeQr() {
    setShowQr(true)
    await loadOfficeQr()
  }

  async function handleRotateQr() {
    if (!user) return
    const confirmed = await swalConfirm({
      title: '¿Renovar QR de hoy?',
      text: 'El código anterior dejará de funcionar al instante.',
      confirmButtonText: 'Sí, renovar',
    })
    if (!confirmed) return
    setLoadingQr(true)
    try {
      const nextQr = await rotateTodayOfficeQrUseCase.execute(user)
      setOfficeQr(nextQr)
      swalSuccess('QR renovado. El anterior ya no vale.')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo renovar el QR',
      )
    } finally {
      setLoadingQr(false)
    }
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
      setOfficeForm({
        officeName: nextSettings.officeName,
        officeLatitude: nextSettings.officeLatitude,
        officeLongitude: nextSettings.officeLongitude,
        officeRadiusMeters: nextSettings.officeRadiusMeters,
      })
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
    return rows.filter(({ technician, attendance }) => {
      const matchesSearch =
        !query ||
        technician.displayName.toLowerCase().includes(query) ||
        technician.email.toLowerCase().includes(query) ||
        (attendance?.areaName ?? '').toLowerCase().includes(query)
      if (!matchesSearch) return false
      if (originFilter === 'oficina') {
        return attendance?.origin === AttendanceOrigin.Oficina
      }
      if (originFilter === 'zona') {
        return attendance?.origin === AttendanceOrigin.Zona
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
  const missing = rows.filter((row) => row.attendance == null).length

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const map = L.map(mapElRef.current, {
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
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer || !settings) return
    layer.clearLayers()

    L.circle([settings.officeLatitude, settings.officeLongitude], {
      radius: settings.officeRadiusMeters,
      color: OFFICE_COLOR,
      fillColor: OFFICE_COLOR,
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(layer)

    L.marker([settings.officeLatitude, settings.officeLongitude], {
      icon: pinIcon(OFFICE_COLOR),
      title: settings.officeName,
    })
      .bindPopup(`<strong>${escapeHtml(settings.officeName)}</strong><br/>Radio ${settings.officeRadiusMeters} m`)
      .addTo(layer)

    const bounds: L.LatLngExpression[] = [
      [settings.officeLatitude, settings.officeLongitude],
    ]

    if (showLocations) {
      for (const { technician, attendance } of filteredRows) {
        if (!attendance) continue
        const color =
          attendance.origin === AttendanceOrigin.Oficina
            ? OFFICE_COLOR
            : ZONE_COLOR
        const latLng: L.LatLngExpression = [
          attendance.latitude,
          attendance.longitude,
        ]
        bounds.push(latLng)
        const photo = attendance.environmentPhotoUrl
          ? `<br/><img src="${escapeHtml(attendance.environmentPhotoUrl)}" alt="" style="width:160px;height:110px;object-fit:cover;border-radius:8px;margin-top:6px" />`
          : ''
        L.marker(latLng, { icon: pinIcon(color), title: technician.displayName })
          .bindPopup(
            `<strong>${escapeHtml(technician.displayName)}</strong><br/>` +
              `${escapeHtml(attendanceOriginLabel(attendance.origin))}` +
              ` · ${formatAttendanceTime(attendance.createdAt)}` +
              (attendance.areaName
                ? `<br/>${escapeHtml(attendance.areaName)}`
                : '') +
              photo,
          )
          .addTo(layer)
      }
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 18)
    } else {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 17 })
    }
    window.setTimeout(() => map.invalidateSize(), 80)
  }, [filteredRows, settings, showLocations])

  useEffect(() => {
    if (!showSettings || !settingsMapElRef.current) return
    const map = L.map(settingsMapElRef.current, {
      center: [officeForm.officeLatitude, officeForm.officeLongitude],
      zoom: 19,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    settingsMarkerRef.current = L.marker(
      [officeForm.officeLatitude, officeForm.officeLongitude],
      { icon: pinIcon(OFFICE_COLOR), draggable: true },
    ).addTo(map)
    settingsCircleRef.current = L.circle(
      [officeForm.officeLatitude, officeForm.officeLongitude],
      {
        radius: officeForm.officeRadiusMeters,
        color: OFFICE_COLOR,
        fillOpacity: 0.1,
      },
    ).addTo(map)
    settingsMapRef.current = map

    function applyPoint(lat: number, lng: number) {
      setOfficeForm((prev) => ({
        ...prev,
        officeLatitude: Number(lat.toFixed(6)),
        officeLongitude: Number(lng.toFixed(6)),
      }))
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
  }, [showSettings])

  useEffect(() => {
    const marker = settingsMarkerRef.current
    const circle = settingsCircleRef.current
    const map = settingsMapRef.current
    if (!marker || !circle || !map) return
    const latLng: L.LatLngExpression = [
      officeForm.officeLatitude,
      officeForm.officeLongitude,
    ]
    marker.setLatLng(latLng)
    circle.setLatLng(latLng)
    circle.setRadius(officeForm.officeRadiusMeters)
  }, [officeForm.officeLatitude, officeForm.officeLongitude, officeForm.officeRadiusMeters])

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault()
    if (!user || savingSettings) return
    setSavingSettings(true)
    try {
      const saved = await saveAttendanceSettingsUseCase.execute(user, officeForm)
      setSettings(saved)
      setShowSettings(false)
      swalSuccess('Oficina actualizada')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo guardar',
      )
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
      swalSuccess('Excel de control descargado')
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

  return (
    <section className="attendance-page">
      <header className="attendance-page__header">
        <div>
          <p className="attendance-page__eyebrow">Control diario</p>
          <h2>Asistencias</h2>
          <p>
            {formatDateKey(dateKey)} · GPS y foto del entorno obligatorios. Excel para control; PDF para evidencia.
          </p>
        </div>
        <div className="attendance-page__toolbar">
          <p className="attendance-page__today">Hoy · {formatDateKey(dateKey)}</p>
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
            <>
              <button
                type="button"
                className="btn btn--soft-primary"
                onClick={() => void openOfficeQr()}
              >
                QR de oficina
              </button>
              <button
                type="button"
                className="btn btn--soft-primary"
                onClick={() => setShowSettings(true)}
              >
                Configurar oficina
              </button>
            </>
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
          <span>En zona</span>
        </article>
        <article className="attendance-kpi attendance-kpi--missing">
          <strong>{missing}</strong>
          <span>Sin marcar</span>
        </article>
        <article className="attendance-kpi">
          <strong>{rows.length}</strong>
          <span>Técnicos</span>
        </article>
      </div>

      <div className="attendance-layout">
        <div className="attendance-list-panel">
          <div className="attendance-filters">
            <label className="field">
              <span>Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, correo o área"
              />
            </label>
            <div className="attendance-chips" role="group" aria-label="Filtro">
              {(
                [
                  ['all', 'Todos'],
                  ['oficina', 'Oficina'],
                  ['zona', 'Zona'],
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
          </div>

          {loading ? (
            <p className="attendance-empty">Cargando asistencia...</p>
          ) : filteredRows.length === 0 ? (
            <p className="attendance-empty">No hay técnicos con ese filtro.</p>
          ) : (
            <ul className="attendance-list">
              {filteredRows.map(({ technician, attendance }) => (
                <li key={technician.id} className="attendance-row">
                  <div className="attendance-row__avatar" aria-hidden="true">
                    {initials(technician.displayName)}
                  </div>
                  <div className="attendance-row__copy">
                    <strong>{technician.displayName}</strong>
                    <span>{technician.email}</span>
                  </div>
                  {attendance ? (
                    <div className="attendance-row__status">
                      {attendance.environmentPhotoUrl ? (
                        <a
                          href={attendance.environmentPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver foto del entorno"
                        >
                          <img
                            className="attendance-row__photo"
                            src={attendance.environmentPhotoUrl}
                            alt="Foto del entorno"
                          />
                        </a>
                      ) : null}
                      <div>
                        <em
                          className={
                            attendance.origin === AttendanceOrigin.Oficina
                              ? 'is-office'
                              : 'is-zone'
                          }
                        >
                          {attendanceOriginLabel(attendance.origin)}
                        </em>
                        <span>
                          {formatAttendanceTime(attendance.createdAt)}
                          {attendance.areaName ? ` · ${attendance.areaName}` : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <em className="is-missing">Sin marcar</em>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="attendance-map-panel">
          <label className="attendance-map-toggle">
            <input
              type="checkbox"
              checked={showLocations}
              onChange={(event) => setShowLocations(event.target.checked)}
            />
            Mostrar ubicaciones de técnicos
          </label>
          <div ref={mapElRef} className="attendance-map" />
        </div>
      </div>

      <AppModal
        open={showSettings}
        title="Oficina para asistencia"
        description="Toca el mapa o arrastra el pin. El técnico solo podrá marcar “Oficina” dentro del radio."
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
              {savingSettings ? 'Guardando...' : 'Guardar oficina'}
            </button>
          </>
        }
      >
        <form
          id="office-settings-form"
          className="login-form"
          onSubmit={handleSaveSettings}
        >
          <label className="field">
            <span>Nombre</span>
            <input
              value={officeForm.officeName}
              onChange={(event) =>
                setOfficeForm((prev) => ({ ...prev, officeName: event.target.value }))
              }
              required
              maxLength={120}
            />
          </label>
          <div ref={settingsMapElRef} className="attendance-settings-map" />
          <div className="attendance-settings-grid">
            <label className="field">
              <span>Latitud</span>
              <input
                type="number"
                step="0.000001"
                value={officeForm.officeLatitude}
                onChange={(event) =>
                  setOfficeForm((prev) => ({
                    ...prev,
                    officeLatitude: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
            <label className="field">
              <span>Longitud</span>
              <input
                type="number"
                step="0.000001"
                value={officeForm.officeLongitude}
                onChange={(event) =>
                  setOfficeForm((prev) => ({
                    ...prev,
                    officeLongitude: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Radio permitido: {officeForm.officeRadiusMeters} m</span>
            <input
              type="range"
              min={MIN_OFFICE_RADIUS_METERS}
              max={MAX_OFFICE_RADIUS_METERS}
              step={1}
              value={officeForm.officeRadiusMeters}
              onChange={(event) =>
                setOfficeForm((prev) => ({
                  ...prev,
                  officeRadiusMeters: Number(event.target.value),
                }))
              }
            />
          </label>
        </form>
      </AppModal>

      <AppModal
        open={showQr && !qrKiosk}
        title="QR de oficina"
        description="Muéstralo en recepción. Cambia cada día y exige GPS dentro del radio."
        onClose={() => {
          if (!loadingQr) setShowQr(false)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => setShowQr(false)}
              disabled={loadingQr}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn--soft-muted"
              onClick={() => void handleRotateQr()}
              disabled={loadingQr || !officeQr}
            >
              Renovar código
            </button>
            <button
              type="button"
              className="btn btn--soft-primary"
              onClick={() => setQrKiosk(true)}
              disabled={loadingQr || !officeQr}
            >
              Pantalla completa
            </button>
          </>
        }
      >
        <div className="attendance-qr">
          {loadingQr || !officeQr ? (
            <p className="attendance-empty">Preparando QR del día...</p>
          ) : (
            <>
              <div className="attendance-qr__code">
                <QRCode value={officeQr.payload} size={220} />
              </div>
              <p>
                Válido solo el {formatDateKey(officeQr.dateKey)}. Si alguien se
                lleva una foto, renuévalo.
              </p>
            </>
          )}
        </div>
      </AppModal>

      {qrKiosk && officeQr ? (
        <div className="attendance-qr-kiosk">
          <p>Asistencia de oficina · {formatDateKey(officeQr.dateKey)}</p>
          <div className="attendance-qr-kiosk__code">
            <QRCode value={officeQr.payload} size={320} />
          </div>
          <span>Escanea con la app · GPS encendido · Una marca por día</span>
          <button
            type="button"
            className="btn btn--soft-muted"
            onClick={() => setQrKiosk(false)}
          >
            Salir de pantalla completa
          </button>
        </div>
      ) : null}
    </section>
  )
}
