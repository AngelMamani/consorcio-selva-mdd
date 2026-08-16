import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import { formatFolderAssignees } from '@/domain/entities/User'
import { DomainError } from '@/domain/errors/DomainError'
import { hasGeoLocation } from '@/domain/value-objects/GeoLocation'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import './MapPage.css'

const MADRE_DE_DIOS_CENTER: L.LatLngExpression = [-12.5933, -69.1891]
const DEFAULT_ZOOM = 7
const FOCUS_ZOOM = 16
const ROUTE_PIN_COLOR = '#1565C0'
const FOCUS_PIN_COLOR = '#2E7D32'

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

function createRouteMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'map-route-marker',
    html: `
      <span class="map-route-marker__pin" style="--pin-color:${color}">
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
  const [searchParams] = useSearchParams()
  const focusFolderId = searchParams.get('folder')?.trim() || ''

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

  const focusedFolder = useMemo(
    () => locatedFolders.find((folder) => folder.id === focusFolderId) ?? null,
    [locatedFolders, focusFolderId],
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
    const defaultIcon = createRouteMarkerIcon(ROUTE_PIN_COLOR)
    const focusIcon = createRouteMarkerIcon(FOCUS_PIN_COLOR)
    let focusMarker: L.Marker | null = null

    for (const folder of locatedFolders) {
      const location = folder.location
      if (!location) continue

      const latLng: L.LatLngExpression = [
        location.latitude,
        location.longitude,
      ]
      bounds.push(latLng)

      const isFocused = folder.id === focusFolderId
      const marker = L.marker(latLng, {
        icon: isFocused ? focusIcon : defaultIcon,
        title: folder.name,
        zIndexOffset: isFocused ? 1000 : 0,
      })

      const accuracy =
        typeof location.accuracyMeters === 'number'
          ? `<br/><small>Precisión ±${Math.round(location.accuracyMeters)} m</small>`
          : ''

      const assignees = escapeHtml(formatFolderAssignees(folder))

      marker.bindPopup(
        `<div class="map-popup">` +
          `<strong>${escapeHtml(folder.name)}</strong><br/>` +
          `<small>Asignado: ${assignees}</small><br/>` +
          `<small>${formatCoords(location.latitude, location.longitude)}</small>` +
          accuracy +
          `<br/><a href="/carpetas/${folder.id}">Ver detalle</a>` +
          `</div>`,
      )
      marker.addTo(layer)
      if (isFocused) focusMarker = marker
    }

    if (focusMarker && focusedFolder?.location) {
      map.setView(
        [focusedFolder.location.latitude, focusedFolder.location.longitude],
        FOCUS_ZOOM,
      )
      window.setTimeout(() => focusMarker?.openPopup(), 120)
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15)
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48] })
    } else {
      map.setView(MADRE_DE_DIOS_CENTER, DEFAULT_ZOOM)
    }

    window.setTimeout(() => map.invalidateSize(), 80)
  }, [locatedFolders, focusFolderId, focusedFolder])

  return (
    <section className="map-page">
      <div className="map-page__bar">
        <div>
          <h1>Mapa de rutas</h1>
          <p className="map-page__subtitle">
            {focusedFolder
              ? `Enfocando: ${focusedFolder.name}`
              : 'Ubicación de cada ruta (carpeta). El técnico asignado se ve en el pin.'}
          </p>
        </div>
        <span className="map-page__count">
          {loading
            ? 'Cargando...'
            : `${locatedFolders.length} ruta${locatedFolders.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {error ? <p className="form-alert form-alert--error">{error}</p> : null}

      {focusFolderId && !loading && !focusedFolder ? (
        <p className="form-alert form-alert--error">
          No se encontró la ubicación de esa carpeta en el mapa.
        </p>
      ) : null}

      <div className="map-page__stage">
        {loading ? (
          <div className="map-page__loading">Cargando mapa...</div>
        ) : null}
        <div ref={mapContainerRef} className="map-page__canvas" />
        {!loading && locatedFolders.length === 0 ? (
          <div className="map-page__empty">
            <h3>Sin ubicaciones aún</h3>
            <p>
              Cuando se cree una ruta/carpeta con GPS, el pin aparecerá aquí.
            </p>
            <Link to="/areas" className="btn btn--soft-muted">
              Ir a carpetas
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
