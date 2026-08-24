import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { NearbySupply, SupplyCatalogStatus } from '@/domain/entities/Supply'
import { SED_FEEDER_RADIUS_METERS } from '@/domain/entities/Supply'
import type { StationHit } from '@/domain/entities/StationHit'
import { DomainError, NotFoundError } from '@/domain/errors/DomainError'
import { UserRole } from '@/domain/value-objects/UserRole'
import { normalizeRouteCode } from '@/domain/value-objects/RouteCode'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import {
  swalConfirm,
  swalError,
  swalSuccess,
} from '@/presentation/utils/appSwal'
import { parseSupplyKml } from '@/infrastructure/kml/parseSupplyKml'
import { parseSedKml } from '@/infrastructure/kml/parseSedKml'
import { detectCatalogKml } from '@/infrastructure/kml/detectCatalogKml'
import './StationsPage.css'

function formatWhen(date: Date): string {
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

function formatMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="stations-search__icon">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
      />
    </svg>
  )
}

export function StationsPage() {
  const { user } = useAuth()
  const {
    getStationByCodeUseCase,
    searchStationsUseCase,
    listSuppliesNearUseCase,
    getSupplyCatalogStatusUseCase,
    importSuppliesUseCase,
    importSedsUseCase,
  } = useDependencies()

  const isAdmin = user?.role === UserRole.Administrador
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const nearbyLayerRef = useRef<L.LayerGroup | null>(null)
  const radiusCircleRef = useRef<L.Circle | null>(null)
  const nearbyMarkersRef = useRef<Map<string, L.Marker>>(new Map())

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<StationHit | null>(null)
  const [nearbySupplies, setNearbySupplies] = useState<NearbySupply[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [suggestions, setSuggestions] = useState<StationHit[]>([])
  const [catalog, setCatalog] = useState<SupplyCatalogStatus | null>(null)
  const [importing, setImporting] = useState(false)
  const [importKind, setImportKind] = useState<'supply' | 'sed' | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    if (!user) return
    void getSupplyCatalogStatusUseCase
      .execute(user)
      .then(setCatalog)
      .catch(() => setCatalog(null))
  }, [user, getSupplyCatalogStatusUseCase])

  useEffect(() => {
    if (!user) return
    const prefix = normalizeRouteCode(query)
    if (prefix.length < 4) {
      setSuggestions([])
      return
    }

    const handle = window.setTimeout(() => {
      void searchStationsUseCase
        .execute(user, prefix)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
    }, 250)

    return () => window.clearTimeout(handle)
  }, [query, user, searchStationsUseCase])

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el || mapRef.current) return

    const map = L.map(el, {
      center: [-12.5933, -69.1891],
      zoom: 12,
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map

    const enableWheel = () => map.scrollWheelZoom.enable()
    const disableWheel = () => map.scrollWheelZoom.disable()
    map.on('click', enableWheel)
    el.addEventListener('mouseleave', disableWheel)

    const refresh = () => map.invalidateSize({ animate: false })
    const resizeObserver = new ResizeObserver(refresh)
    resizeObserver.observe(el)
    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, { passive: true })
    window.setTimeout(refresh, 80)
    window.setTimeout(refresh, 320)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh)
      map.off('click', enableWheel)
      el.removeEventListener('mouseleave', disableWheel)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      nearbyLayerRef.current = null
      radiusCircleRef.current = null
      nearbyMarkersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    setNearbySupplies([])
    if (!user || selected?.kind !== 'sed') {
      setLoadingNearby(false)
      return
    }

    let cancelled = false
    setLoadingNearby(true)
    void listSuppliesNearUseCase
      .execute(user, selected.latitude, selected.longitude)
      .then((items) => {
        if (!cancelled) setNearbySupplies(items)
      })
      .catch(() => {
        if (!cancelled) setNearbySupplies([])
      })
      .finally(() => {
        if (!cancelled) setLoadingNearby(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected, user, listSuppliesNearUseCase])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markerRef.current?.remove()
    markerRef.current = null
    nearbyLayerRef.current?.remove()
    nearbyLayerRef.current = null
    radiusCircleRef.current?.remove()
    radiusCircleRef.current = null
    nearbyMarkersRef.current.clear()

    if (!selected) {
      map.setView([-12.5933, -69.1891], 12)
      window.setTimeout(() => map.invalidateSize({ animate: false }), 50)
      return
    }

    const marker = L.marker([selected.latitude, selected.longitude], {
      icon: L.divIcon({
        className: 'stations-pin',
        html: `<span class="stations-pin__dot stations-pin__dot--${selected.kind}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 800,
    })
    marker.bindPopup(
      `<strong>${selected.kind === 'sed' ? 'SED' : 'Suministro'} ${selected.code}</strong><br/><small>${selected.detail}</small><br/><small>${formatCoords(selected.latitude, selected.longitude)}</small>`,
    )
    marker.addTo(map)
    markerRef.current = marker

    if (selected.kind === 'sed') {
      const circle = L.circle([selected.latitude, selected.longitude], {
        radius: SED_FEEDER_RADIUS_METERS,
        color: '#ef6c00',
        weight: 1.5,
        fillColor: '#ef6c00',
        fillOpacity: 0.08,
      })
      circle.addTo(map)
      radiusCircleRef.current = circle

      const layer = L.layerGroup()
      for (const supply of nearbySupplies) {
        const supplyMarker = L.marker([supply.latitude, supply.longitude], {
          icon: L.divIcon({
            className: 'stations-pin',
            html: '<span class="stations-pin__dot stations-pin__dot--nearby"></span>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        })
        supplyMarker.bindPopup(
          `<strong>Suministro ${supply.routeCode}</strong><br/><small>${formatMeters(supply.distanceMeters)} de la SED</small><br/><small>${formatCoords(supply.latitude, supply.longitude)}</small>`,
        )
        supplyMarker.addTo(layer)
        nearbyMarkersRef.current.set(supply.routeCode, supplyMarker)
      }
      layer.addTo(map)
      nearbyLayerRef.current = layer

      if (nearbySupplies.length > 0) {
        const bounds = L.latLngBounds([
          [selected.latitude, selected.longitude],
        ])
        for (const supply of nearbySupplies) {
          bounds.extend([supply.latitude, supply.longitude])
        }
        map.fitBounds(bounds.pad(0.28), { maxZoom: 18, animate: false })
      } else {
        map.setView([selected.latitude, selected.longitude], 16)
      }
    } else {
      map.setView([selected.latitude, selected.longitude], 17)
    }

    window.setTimeout(() => {
      map.invalidateSize({ animate: false })
      if (selected.kind !== 'sed') {
        marker.openPopup()
      }
    }, 80)
  }, [selected, nearbySupplies])

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    if (!user || searching) return
    const code = normalizeRouteCode(query)
    if (code.length < 2) {
      swalError('Escribe al menos 2 dígitos del código')
      return
    }

    setSearching(true)
    try {
      if (code.length >= 7) {
        try {
          const hit = await getStationByCodeUseCase.execute(user, code)
          setSelected(hit)
          setSuggestions([])
          return
        } catch (err) {
          if (!(err instanceof NotFoundError)) throw err
        }
      }

      const found = await searchStationsUseCase.execute(user, code)
      setSuggestions(found)
      if (found.length === 1) {
        setSelected(found[0])
      } else {
        setSelected(null)
      }
      if (found.length === 0) {
        swalError(
          (catalog?.sedCount ?? 0) === 0 && /^20/.test(code)
            ? 'Aún no hay SEDs en Firebase. Importa SEDs.kml y vuelve a buscar.'
            : 'No hay suministro ni SED con ese código',
        )
      }
    } catch (err) {
      setSelected(null)
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo buscar la estación',
      )
    } finally {
      setSearching(false)
    }
  }

  async function handleImport(file: File) {
    if (!user || importing) return

    const confirmed = await swalConfirm({
      title: '¿Importar KML?',
      text: 'Puedes subir SUMINISTRO Y RU.kml o SEDs.kml. El archivo se reconoce solo. Puede tardar varios minutos; no cierres esta pestaña.',
      confirmButtonText: 'Sí, importar',
    })
    if (!confirmed) return

    setImporting(true)
    setProgress({ done: 0, total: 0 })
    try {
      const xml = await file.text()
      const kind = detectCatalogKml(xml)
      if (!kind) {
        throw new DomainError(
          'No se reconoció el KML. Usa SUMINISTRO Y RU.kml o SEDs.kml',
        )
      }
      setImportKind(kind)

      if (kind === 'sed') {
        const parsed = parseSedKml(xml)
        if (parsed.seds.length === 0) {
          throw new DomainError('El archivo no tiene SEDs con código válido')
        }
        const status = await importSedsUseCase.execute(user, {
          seds: parsed.seds,
          skipped: parsed.skipped,
          onProgress: (done, total) => setProgress({ done, total }),
        })
        setCatalog(status)
        swalSuccess(
          `Listo: ${status.sedCount.toLocaleString('es-PE')} SEDs importadas`,
        )
        return
      }

      const parsed = parseSupplyKml(xml)
      if (parsed.supplies.length === 0) {
        throw new DomainError(
          'El archivo no tiene puntos con código de ruta válido',
        )
      }

      const status = await importSuppliesUseCase.execute(user, {
        supplies: parsed.supplies,
        skipped: parsed.skipped,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setCatalog(status)
      swalSuccess(
        `Listo: ${status.count.toLocaleString('es-PE')} suministros importados`,
      )
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo importar el KML',
      )
    } finally {
      setImporting(false)
      setImportKind(null)
      setProgress({ done: 0, total: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const progressLabel = useMemo(() => {
    if (!importing || progress.total === 0) return ''
    const pct = Math.round((progress.done / progress.total) * 100)
    return `${progress.done.toLocaleString('es-PE')} / ${progress.total.toLocaleString('es-PE')} (${pct}%)`
  }, [importing, progress])

  return (
    <section className="stations-page">
      <header className="page-header">
        <div>
          <p className="stations-page__eyebrow">Campo</p>
          <h1>Estaciones</h1>
          <p>
            Busca un suministro (código de ruta) o una SED (código 2000xxx).
            Si eliges una SED, el mapa muestra los medidores a menos de{' '}
            {SED_FEEDER_RADIUS_METERS} m.
          </p>
        </div>
        {isAdmin ? (
          <div className="stations-page__import">
            <input
              ref={fileInputRef}
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml,text/xml"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImport(file)
              }}
            />
            <button
              type="button"
              className="btn btn--soft-primary"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Importando...' : 'Importar KML'}
            </button>
            {catalog ? (
              <span className="stations-page__meta">
                Última carga · {formatWhen(catalog.importedAt)}
              </span>
            ) : (
              <span className="stations-page__meta">
                Sube SUMINISTRO Y RU.kml y SEDs.kml
              </span>
            )}
          </div>
        ) : null}
      </header>

      <div className="stations-kpis">
        <div className="stations-kpis__item">
          <strong>{(catalog?.count ?? 0).toLocaleString('es-PE')}</strong>
          <span>Suministros</span>
        </div>
        <div className="stations-kpis__item">
          <strong>{(catalog?.sedCount ?? 0).toLocaleString('es-PE')}</strong>
          <span>SEDs</span>
        </div>
      </div>

      {importing ? (
        <div className="stations-progress" role="status">
          <div
            className="stations-progress__bar"
            style={{
              width:
                progress.total > 0
                  ? `${Math.round((progress.done / progress.total) * 100)}%`
                  : '8%',
            }}
          />
          <p>
            Importando {importKind === 'sed' ? 'SEDs' : 'suministros'}…
            {progressLabel ? ` ${progressLabel}` : ''}
          </p>
        </div>
      ) : null}

      <form className="stations-toolbar" onSubmit={(event) => void handleSearch(event)}>
        <label className="stations-search">
          <IconSearch />
          <input
            value={query}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Código, últimos dígitos, sin el 12 o SED 2000420"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="btn btn--soft-primary"
          disabled={searching || importing}
        >
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {suggestions.length > 1 ? (
        <ul className="stations-suggest">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(item)
                  setQuery(item.code)
                  setSuggestions([])
                }}
              >
                <strong>
                  {item.kind === 'sed' ? 'SED' : 'Suministro'} {item.code}
                </strong>
                <span>{item.kind === 'sed' ? item.detail : formatCoords(item.latitude, item.longitude)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <article className="stations-result">
        <div className="stations-result__info">
          {selected ? (
            <>
              <p className="stations-page__eyebrow">
                {selected.kind === 'sed' ? 'SED' : 'Suministro'}
              </p>
              <h2>{selected.code}</h2>
              <p>{selected.detail}</p>
              <dl>
                <div>
                  <dt>Coordenadas</dt>
                  <dd>{formatCoords(selected.latitude, selected.longitude)}</dd>
                </div>
                {selected.kind === 'supply' ? (
                  <div>
                    <dt>Prefijo</dt>
                    <dd>{selected.code.slice(0, 4)}</dd>
                  </div>
                ) : (
                  <div>
                    <dt>Suministros cercanos</dt>
                    <dd>
                      {loadingNearby
                        ? 'Buscando medidores…'
                        : `${nearbySupplies.length.toLocaleString('es-PE')} a menos de ${SED_FEEDER_RADIUS_METERS} m`}
                    </dd>
                  </div>
                )}
              </dl>
              {selected.kind === 'sed' ? (
                <p className="stations-nearby__hint">
                  El KML no dice qué medidor cuelga de qué transformador; se
                  infiere por distancia.
                </p>
              ) : null}
              {selected.kind === 'sed' && nearbySupplies.length > 0 ? (
                <ul className="stations-nearby">
                  {nearbySupplies.map((supply) => (
                    <li key={supply.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const map = mapRef.current
                          const pin = nearbyMarkersRef.current.get(
                            supply.routeCode,
                          )
                          if (!map || !pin) return
                          map.panTo([supply.latitude, supply.longitude])
                          pin.openPopup()
                        }}
                      >
                        <strong>{supply.routeCode}</strong>
                        <span>{formatMeters(supply.distanceMeters)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <a
                className="btn btn--soft-muted"
                href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir en Google Maps
              </a>
            </>
          ) : (
            <div className="stations-empty">
              <h3>Busca un suministro o una SED</h3>
              <p>
                Código de ruta del medidor (11 dígitos) o código de SED (7
                dígitos, ej. 2000420). En una SED el mapa pinta también los
                suministros cercanos.
              </p>
            </div>
          )}
        </div>
        <div className="stations-result__map">
          <div ref={mapContainerRef} className="stations-result__canvas" />
        </div>
      </article>
    </section>
  )
}
