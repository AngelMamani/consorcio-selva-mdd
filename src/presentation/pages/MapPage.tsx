import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import { DomainError } from '@/domain/errors/DomainError'
import { hasGeoLocation } from '@/domain/value-objects/GeoLocation'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import './MapPage.css'

const MADRE_DE_DIOS_CENTER: L.LatLngExpression = [-12.5933, -69.1891]
const DEFAULT_ZOOM = 7

const TECH_COLORS = [
  '#C62828',
  '#1565C0',
  '#2E7D32',
  '#EF6C00',
  '#6A1B9A',
  '#00838F',
  '#AD1457',
  '#4527A0',
  '#558B2F',
  '#00695C',
  '#D84315',
  '#283593',
] as const

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function hashOwnerId(ownerId: string): number {
  let hash = 0
  for (let i = 0; i < ownerId.length; i += 1) {
    hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0
  }
  return hash
}

function colorForTechnician(ownerId: string): string {
  return TECH_COLORS[hashOwnerId(ownerId) % TECH_COLORS.length]
}

function createTechnicianMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'map-tech-marker',
    html: `
      <span class="map-tech-marker__pin" style="--pin-color:${color}">
        <svg viewBox="0 0 24 36" aria-hidden="true">
          <path
            d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
            fill="var(--pin-color)"
            stroke="#fff"
            stroke-width="1.5"
          />
          <circle cx="12" cy="12" r="4.2" fill="#fff"/>
        </svg>
      </span>
    `,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -36],
  })
}

export function MapPage() {
  const { user } = useAuth()
  const { listFoldersUseCase } = useDependencies()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  const [folders, setFolders] = useState<ImageFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const locatedFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.location != null && hasGeoLocation(folder.location),
      ),
    [folders],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await listFoldersUseCase.execute(user!)
        if (cancelled) return
        setFolders(result)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof DomainError
            ? err.message
            : 'No se pudieron cargar las ubicaciones',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, listFoldersUseCase])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: MADRE_DE_DIOS_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
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

    const bounds: L.LatLngExpression[] = []

    for (const folder of locatedFolders) {
      const location = folder.location
      if (!location) continue

      const latLng: L.LatLngExpression = [
        location.latitude,
        location.longitude,
      ]
      bounds.push(latLng)

      const color = colorForTechnician(folder.ownerId)
      const marker = L.marker(latLng, {
        icon: createTechnicianMarkerIcon(color),
        title: `${folder.ownerName} — ${folder.name}`,
      })

      const accuracy =
        typeof location.accuracyMeters === 'number'
          ? `<br/><small>Precisión ±${Math.round(location.accuracyMeters)} m</small>`
          : ''

      marker.bindPopup(
        `<div class="map-popup">` +
          `<span class="map-popup__swatch" style="background:${color}"></span>` +
          `<strong>${escapeHtml(folder.name)}</strong><br/>` +
          `<span style="color:${color};font-weight:700">${escapeHtml(folder.ownerName)}</span><br/>` +
          `<small>${formatCoords(location.latitude, location.longitude)}</small>` +
          accuracy +
          `<br/><a href="/carpetas/${folder.id}">Ver carpeta</a>` +
          `</div>`,
      )
      marker.addTo(layer)
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 15)
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48] })
    } else {
      map.setView(MADRE_DE_DIOS_CENTER, DEFAULT_ZOOM)
    }

    window.setTimeout(() => map.invalidateSize(), 80)
  }, [locatedFolders])

  return (
    <section className="map-page">
      <div className="map-page__bar">
        <h1>Mapa</h1>
        <span className="map-page__count">
          {loading
            ? 'Cargando...'
            : `${locatedFolders.length} ubicación${locatedFolders.length === 1 ? '' : 'es'}`}
        </span>
      </div>

      {error ? <p className="form-alert form-alert--error">{error}</p> : null}

      <div className="map-page__stage">
        {loading ? (
          <div className="map-page__loading">Cargando mapa...</div>
        ) : null}
        <div ref={mapContainerRef} className="map-page__canvas" />
        {!loading && locatedFolders.length === 0 ? (
          <div className="map-page__empty">
            <h3>Sin ubicaciones aún</h3>
            <p>
              Cuando un técnico cree una carpeta con GPS, el pin aparecerá
              aquí.
            </p>
            <Link to="/carpetas" className="btn btn--soft-muted">
              Ir a carpetas
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
