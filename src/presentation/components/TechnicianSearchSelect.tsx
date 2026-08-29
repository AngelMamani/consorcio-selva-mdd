import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { User } from '@/domain/entities/User'
import './TechnicianSearchSelect.css'

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

export function TechnicianSearchSelect({
  technicians,
  valueId,
  valueLabel = '',
  disabled = false,
  compact = false,
  placeholder = 'Buscar técnico…',
  emptyLabel = 'Sin asignar',
  onChange,
}: {
  technicians: User[]
  valueId: string
  /** Nombre a mostrar si el id no está en la lista (p. ej. import Excel). */
  valueLabel?: string
  disabled?: boolean
  compact?: boolean
  placeholder?: string
  emptyLabel?: string
  onChange: (technician: { id: string; displayName: string } | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const deferred = useDeferredValue(query)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 240 })

  const selected = technicians.find((item) => item.id === valueId) ?? null
  const shownName = selected?.displayName || valueLabel.trim() || ''
  const filtered = useMemo(() => {
    const term = deferred.trim().toLowerCase()
    if (!term) return technicians
    return technicians.filter((tech) =>
      tech.displayName.toLowerCase().includes(term),
    )
  }, [technicians, deferred])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  useEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 220)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    const below = rect.bottom + 6
    const top =
      below + 280 > window.innerHeight
        ? Math.max(8, rect.top - 286)
        : below
    setMenuPos({ top, left: Math.max(8, left), width })
  }, [open, filtered.length, shownName])

  function pick(tech: User | null) {
    onChange(tech ? { id: tech.id, displayName: tech.displayName } : null)
    setQuery('')
    setOpen(false)
  }

  const list = (
    <div
      ref={menuRef}
      className="tech-search__menu tech-search__menu--floating"
      role="listbox"
      style={{
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
      }}
    >
      <button
        type="button"
        role="option"
        className={`tech-search__option${!valueId && !shownName ? ' is-selected' : ''}`}
        onClick={() => pick(null)}
      >
        {emptyLabel}
      </button>
      {filtered.length === 0 ? (
        <p className="tech-search__empty">No hay técnicos para mostrar</p>
      ) : (
        filtered.map((tech) => (
          <button
            key={tech.id}
            type="button"
            role="option"
            className={`tech-search__option${tech.id === valueId ? ' is-selected' : ''}`}
            onClick={() => pick(tech)}
          >
            <strong>{tech.displayName}</strong>
          </button>
        ))
      )}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={`tech-search${compact ? ' tech-search--compact' : ''}${
        shownName ? ' tech-search--assigned' : ''
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <label className="tech-search__field">
        <span className="sr-only">{placeholder}</span>
        <IconPeople />
        <input
          type="search"
          value={open ? query : shownName}
          disabled={disabled}
          placeholder={shownName || placeholder}
          onFocus={() => {
            if (disabled) return
            setOpen(true)
            setQuery('')
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
      </label>
      {open && !disabled ? createPortal(list, document.body) : null}
    </div>
  )
}
