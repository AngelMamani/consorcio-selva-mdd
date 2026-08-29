import { installationRegisteredFlag } from '@/domain/entities/InstallationOrder'
import { meterChangeDoneFlag } from '@/domain/entities/MeterChangeOrder'
import './RegisteredFlagPicker.css'

export function RegisteredFlagPicker({
  value,
  disabled = false,
  compact = false,
  withPending = false,
  onChange,
}: {
  value: string
  disabled?: boolean
  compact?: boolean
  /** Incluye PENDIENTE antes de SI/NO (cambio de medidor). */
  withPending?: boolean
  onChange: (value: 'PENDIENTE' | 'SI' | 'NO') => void
}) {
  const options = withPending
    ? (['PENDIENTE', 'SI', 'NO'] as const)
    : (['SI', 'NO'] as const)
  const current = withPending
    ? meterChangeDoneFlag(value)
    : installationRegisteredFlag(value)

  return (
    <div
      className={`io-sino${compact ? ' io-sino--compact' : ''}${
        withPending ? ' io-sino--pending' : ''
      }`}
      role="radiogroup"
      aria-label={withPending ? 'Estado PENDIENTE, SI o NO' : 'Estado SI o NO'}
      onClick={(event) => event.stopPropagation()}
    >
      {options.map((flag) => (
        <button
          key={flag}
          type="button"
          data-flag={flag}
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
