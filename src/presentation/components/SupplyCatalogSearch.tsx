import { useEffect, useState } from 'react'
import { supplyHasLocation, type Supply } from '@/domain/entities/Supply'
import { normalizeRouteCode } from '@/domain/value-objects/RouteCode'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError } from '@/presentation/utils/appSwal'
import './SupplyCatalogSearch.css'

export function SupplyCatalogSearch({
  value,
  onChange,
  onPickSupply,
  placeholder = 'Buscar en rutas de suministro…',
  hint = 'Escribe al menos 3 dígitos. Sale el mismo catálogo de rutas de suministro.',
  pickedCaption = 'Ruta del catálogo de suministros',
  minCodeLength = 7,
  maxCodeLength = 15,
  disabled = false,
}: {
  value: string
  onChange: (code: string) => void
  onPickSupply?: (supply: Supply | null) => void
  placeholder?: string
  hint?: string
  pickedCaption?: string
  minCodeLength?: number
  maxCodeLength?: number
  disabled?: boolean
}) {
  const { user } = useAuth()
  const { searchSuppliesUseCase, getSupplyByRouteCodeUseCase } =
    useDependencies()
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<Supply[]>([])
  const [searching, setSearching] = useState(false)
  const [pickedSupply, setPickedSupply] = useState<Supply | null>(null)

  const selected = normalizeRouteCode(value)

  useEffect(() => {
    if (!selected) {
      setPickedSupply(null)
      return
    }
    if (!user) return
    let cancelled = false
    void getSupplyByRouteCodeUseCase
      .find(user, selected)
      .then((supply) => {
        if (!cancelled) setPickedSupply(supply)
      })
      .catch(() => {
        if (!cancelled) setPickedSupply(null)
      })
    return () => {
      cancelled = true
    }
  }, [selected, user, getSupplyByRouteCodeUseCase])

  useEffect(() => {
    if (!user || disabled || selected) {
      setSuggestions([])
      setSearching(false)
      return
    }
    const digits = normalizeRouteCode(draft).slice(0, maxCodeLength)
    if (digits.length < 3) {
      setSuggestions([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const handle = window.setTimeout(() => {
      void searchSuppliesUseCase
        .execute(user, digits)
        .then((hits) => {
          if (!cancelled) setSuggestions(hits)
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [draft, user, disabled, selected, searchSuppliesUseCase, maxCodeLength])

  function pick(supplyOrCode: Supply | string) {
    const supply =
      typeof supplyOrCode === 'string'
        ? null
        : supplyOrCode
    const code = normalizeRouteCode(
      typeof supplyOrCode === 'string' ? supplyOrCode : supplyOrCode.routeCode,
    )
    onChange(code)
    onPickSupply?.(supply)
    setPickedSupply(supply)
    setDraft('')
    setSuggestions([])
  }

  async function useDraftCode() {
    const code = normalizeRouteCode(draft)
    if (code.length < minCodeLength || code.length > maxCodeLength) {
      swalError(
        `El código debe tener entre ${minCodeLength} y ${maxCodeLength} dígitos`,
      )
      return
    }
    if (!user) {
      pick(code)
      return
    }
    try {
      const supply = await getSupplyByRouteCodeUseCase.find(user, code)
      if (supply) pick(supply)
      else pick(code)
    } catch {
      pick(code)
    }
  }

  function clear() {
    onChange('')
    onPickSupply?.(null)
    setPickedSupply(null)
  }

  if (selected) {
    const hasGps = pickedSupply ? supplyHasLocation(pickedSupply) : false
    const locationLabel =
      hasGps && pickedSupply
        ? `GPS: ${pickedSupply.latitude}, ${pickedSupply.longitude}`
        : 'Sin GPS en el catálogo'
    return (
      <div className="supply-search">
        <div className="supply-search__picked">
          <div>
            <strong>{selected}</strong>
            <small>
              {pickedCaption}
              <br />
              {locationLabel}
              {pickedSupply?.note ? ` · ${pickedSupply.note}` : ''}
            </small>
          </div>
          <button
            type="button"
            className="btn btn--soft-rose btn--small"
            disabled={disabled}
            onClick={clear}
          >
            Quitar
          </button>
        </div>
      </div>
    )
  }

  const digits = normalizeRouteCode(draft)

  return (
    <div className="supply-search">
      <div className="supply-search__add">
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (suggestions.length === 1) {
                pick(suggestions[0])
                return
              }
              void useDraftCode()
            }
          }}
        />
        <button
          type="button"
          className="btn btn--soft-blue btn--small"
          disabled={disabled}
          onClick={() => void useDraftCode()}
        >
          Usar
        </button>
      </div>
      {searching ? (
        <p className="supply-search__hint">Buscando en rutas de suministro…</p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul className="supply-search__suggest" role="listbox">
          {suggestions.map((supply) => (
            <li key={supply.id || supply.routeCode}>
              <button type="button" onClick={() => pick(supply)}>
                <strong>{supply.routeCode}</strong>
                <small>
                  {supplyHasLocation(supply) ? 'Con GPS' : 'Sin GPS'}
                  {supply.note ? ` · ${supply.note}` : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : digits.length >= 3 && !searching ? (
        <p className="supply-search__hint">
          Sin coincidencias. Si el código tiene {minCodeLength} a{' '}
          {maxCodeLength} dígitos, puedes usarlo igual.
        </p>
      ) : (
        <p className="supply-search__hint">{hint}</p>
      )}
    </div>
  )
}
