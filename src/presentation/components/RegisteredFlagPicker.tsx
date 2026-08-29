import { installationRegisteredFlag } from '@/domain/entities/InstallationOrder'
import './RegisteredFlagPicker.css'

export function RegisteredFlagPicker({
  value,
  disabled = false,
  compact = false,
  onChange,
}: {
  value: string
  disabled?: boolean
  compact?: boolean
  onChange: (value: 'SI' | 'NO') => void
}) {
  const current = installationRegisteredFlag(value)
  return (
    <div
      className={`io-sino${compact ? ' io-sino--compact' : ''}`}
      role="radiogroup"
      aria-label="Estado SI o NO"
      onClick={(event) => event.stopPropagation()}
    >
      {(['SI', 'NO'] as const).map((flag) => (
        <button
          key={flag}
          type="button"
          className={current === flag ? 'is-active' : ''}
          aria-pressed={current === flag}
          disabled={disabled}
          onClick={() => onChange(flag)}
        >
          {flag}
        </button>
      ))}
    </div>
  )
}
