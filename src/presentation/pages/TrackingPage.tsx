import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TechnicianLocation } from '@/domain/entities/TechnicianLocation'
import {
  formatLocationSeenAt,
  technicianLocationIsLive,
  technicianLocationStatusLabel,
} from '@/domain/entities/TechnicianLocation'
import type { TechnicianRoutePoint } from '@/domain/entities/TechnicianRoutePoint'
import {
  formatRouteLength,
  limaDateKey,
  routeLengthMeters,
  splitRouteSegments,
} from '@/domain/entities/TechnicianRoutePoint'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError } from '@/presentation/utils/appSwal'
import './TrackingPage.css'

const DEFAULT_CENTER: L.LatLngExpression = [-12.5933, -69.1891]
const ROUTE_COLOR = '#1a7fd4'

function mapIsAlive(map: L.Map | null): map is L.Map {
  if (!map) return false
  const container = map.getContainer()
  return Boolean(container?.isConnected && map.getPane('mapPane'))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function pinHtml(location: TechnicianLocation, selected: boolean): string {
  const live = technicianLocationIsLive(location)
  const tone = live ? 'live' : location.gpsActive ? 'stale' : 'off'
  return `<span class="track-pin__dot track-pin__dot--${tone}${selected ? ' is-selected' : ''}"></span><span class="track-pin__name">${escapeHtml(location.displayName)}</span>`
}

export function TrackingPage() {
  const { user } = useAuth()
  const { watchTechnicianLocationsUseCase, watchTechnicianRouteUseCase } =
    useDependencies()
  const [locations, setLocations] = useState<TechnicianLocation[]>([])
  const [routePoints, setRoutePoints] = useState<TechnicianRoutePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState(() => limaDateKey())
  const [now, setNow] = useState(() => Date.now())

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const fittedKeyRef = useRef('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return locations
    return locations.filter((item) =>
      item.displayName.toLowerCase().includes(term),
    )
  }, [locations, search])

  const liveCount = locations.filter((item) =>
    technicianLocationIsLive(item, now),
  ).length
  const routeMeters = routeLengthMeters(routePoints)
  const selectedName =
    filtered.find((item) => item.userId === selectedId)?.displayName ?? ''

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    try {
      const stop = watchTechnicianLocationsUseCase.watch(
        user,
        (next) => {
          if (cancelled) return
          setLocations(next)
          setLoading(false)
        },
        () => {
          if (cancelled) return
          setLoading(false)
          swalError('No se pudo cargar el seguimiento')
        },
      )
      return () => {
        cancelled = true
        stop()
      }
    } catch (err) {
      setLoading(false)
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo abrir el seguimiento',
      )
    }
  }, [user, watchTechnicianLocationsUseCase])

  useEffect(() => {
    if (!user || !selectedId) {
      setRoutePoints([])
      return
    }
    let cancelled = false
    try {
      const stop = watchTechnicianRouteUseCase.watch(
        user,
        selectedId,
        dateKey,
        (next) => {
          if (!cancelled) setRoutePoints(next)
        },
        () => {
          if (!cancelled) swalError('No se pudo cargar el recorrido')
        },
      )
      return () => {
        cancelled = true
        stop()
      }
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo abrir el recorrido',
      )
    }
  }, [user, selectedId, dateKey, watchTechnicianRouteUseCase])

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el || mapRef.current) return
    const map = L.map(el, {
      center: DEFAULT_CENTER,
      zoom: 12,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)
    const refresh = () => {
      if (mapIsAlive(map)) map.invalidateSize({ animate: false })
    }
    const resize = new ResizeObserver(refresh)
    resize.observe(el)
    const timers = [window.setTimeout(refresh, 80), window.setTimeout(refresh, 320)]
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      resize.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      routeLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!mapIsAlive(map) || !layer) return
    layer.clearLayers()
    const bounds = L.latLngBounds([])
    for (const location of filtered) {
      const selected = location.userId === selectedId
      const marker = L.marker([location.latitude, location.longitude], {
        icon: L.divIcon({
          className: 'track-pin',
          html: pinHtml(location, selected),
          iconSize: [160, 36],
          iconAnchor: [16, 30],
        }),
        zIndexOffset: selected ? 800 : technicianLocationIsLive(location, now)
          ? 500
          : 200,
      })
      marker.bindPopup(
        `<strong>${escapeHtml(location.displayName)}</strong><br/>${escapeHtml(technicianLocationStatusLabel(location, now))}<br/><small>Última vez: ${escapeHtml(formatLocationSeenAt(location.updatedAt))}</small>`,
      )
      marker.on('click', () => setSelectedId(location.userId))
      marker.addTo(layer)
      bounds.extend([location.latitude, location.longitude])
    }
    if (!selectedId && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16 })
    }
  }, [filtered, selectedId, now])

  useEffect(() => {
    const map = mapRef.current
    const layer = routeLayerRef.current
    if (!mapIsAlive(map) || !layer) return
    layer.clearLayers()
    if (!selectedId) {
      fittedKeyRef.current = ''
      return
    }
    const segments = splitRouteSegments(routePoints)
    const bounds = L.latLngBounds([])
    for (const segment of segments) {
      const latlngs = segment.map(
        (point) => [point.latitude, point.longitude] as L.LatLngTuple,
      )
      L.polyline(latlngs, {
        color: ROUTE_COLOR,
        weight: 5,
        opacity: 0.88,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(layer)
      for (const point of latlngs) bounds.extend(point)
    }
    const start = routePoints[0]
    if (start) {
      L.circleMarker([start.latitude, start.longitude], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#2e7d32',
        fillOpacity: 1,
      })
        .bindTooltip('Inicio')
        .addTo(layer)
      bounds.extend([start.latitude, start.longitude])
    }
    const fitKey = `${selectedId}|${dateKey}`
    if (bounds.isValid() && fittedKeyRef.current !== fitKey) {
      map.fitBounds(bounds.pad(0.18), { maxZoom: 16 })
      fittedKeyRef.current = fitKey
    }
  }, [routePoints, selectedId, dateKey])

  return (
    <section className="track-page">
      <header className="page-header">
        <div>
          <p className="track-page__eyebrow">Campo</p>
          <h1>Seguimiento</h1>
          <p>
            Ubicación y recorrido del aplicativo móvil. Elige una persona para
            ver el trazo del día.
          </p>
        </div>
        <div className="track-page__kpis">
          <div>
            <strong>{liveCount}</strong>
            <span>en vivo</span>
          </div>
          <div>
            <strong>
              {selectedId && routePoints.length > 1
                ? formatRouteLength(routeMeters)
                : locations.length}
            </strong>
            <span>
              {selectedId && routePoints.length > 1
                ? 'recorrido'
                : 'con historial'}
            </span>
          </div>
        </div>
      </header>

      <div className="track-page__layout">
        <aside className="track-page__list panel">
          <label className="track-page__search">
            <span>Día del recorrido</span>
            <input
              type="date"
              value={dateKey}
              max={limaDateKey()}
              onChange={(event) => {
                if (event.target.value) setDateKey(event.target.value)
              }}
            />
          </label>
          <label className="track-page__search">
            <span className="sr-only">Buscar persona</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar técnico…"
            />
          </label>
          {selectedId ? (
            <p className="track-page__hint">
              {routePoints.length > 1
                ? `${selectedName}: ${formatRouteLength(routeMeters)} el ${dateKey}`
                : `${selectedName}: aún no hay recorrido este día`}
            </p>
          ) : (
            <p className="track-page__hint">
              Elige una persona para marcar su recorrido.
            </p>
          )}
          {loading ? (
            <p className="track-page__empty">Cargando ubicaciones…</p>
          ) : filtered.length === 0 ? (
            <p className="track-page__empty">
              Aún no hay ubicaciones. Se ven cuando alguien entra al aplicativo
              con GPS activo.
            </p>
          ) : (
            <ul>
              {filtered.map((location) => {
                const live = technicianLocationIsLive(location, now)
                return (
                  <li key={location.userId}>
                    <button
                      type="button"
                      className={
                        location.userId === selectedId ? 'is-selected' : ''
                      }
                      onClick={() => setSelectedId(location.userId)}
                    >
                      <span
                        className={`track-page__dot ${live ? 'is-live' : location.gpsActive ? 'is-stale' : 'is-off'}`}
                      />
                      <span>
                        <strong>{location.displayName}</strong>
                        <small>
                          {technicianLocationStatusLabel(location, now)} ·{' '}
                          {formatLocationSeenAt(location.updatedAt)}
                        </small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
        <div className="track-page__map panel">
          <div ref={mapContainerRef} className="track-page__canvas" />
        </div>
      </div>
    </section>
  )
}
