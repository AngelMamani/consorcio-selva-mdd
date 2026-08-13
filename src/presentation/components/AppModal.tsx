import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './AppModal.css'

interface AppModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
  danger?: boolean
}

export function AppModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  danger = false,
}: AppModalProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="app-modal-root" role="presentation">
      <button
        type="button"
        className="app-modal-backdrop"
        aria-label="Cerrar modal"
        onClick={onClose}
      />
      <div
        className={`app-modal app-modal--${size} ${danger ? 'app-modal--danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <header className="app-modal__header">
          <div>
            <h3 id="app-modal-title">{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="app-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <div className="app-modal__body">{children}</div>
        {footer ? <footer className="app-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
