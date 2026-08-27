import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'
import { HOME_PATH } from '@/domain/value-objects/AppMenuPermission'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { DomainError } from '@/domain/errors/DomainError'
import { securePasswordRequirementsMessage } from '@/domain/value-objects/PasswordPolicy'
import './LoginPage.css'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const { changeOwnPasswordUseCase, logoutUseCase } = useDependencies()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setError(null)
    setSubmitting(true)

    try {
      const updated = await changeOwnPasswordUseCase.execute(
        user,
        password,
        confirmPassword,
      )
      setUser(updated)
      navigate(HOME_PATH, { replace: true })
    } catch (err) {
      setError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo actualizar la contraseña',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logoutUseCase.execute()
    setUser(null)
    navigate('/login', { replace: true })
  }

  return (
    <main className="login-page login-page--plain">
      <section className="login-card" aria-labelledby="change-password-title">
        <div className="login-card__brand">
          <img src={logo} alt="Consorcio Selva MDD" className="login-card__logo" />
          <div>
            <p className="login-card__eyebrow">Seguridad de acceso</p>
            <h1 id="change-password-title">Cambia tu contraseña</h1>
            <p className="login-card__subtitle">
              Estás usando la contraseña temporal 87654321. Elige otra para
              continuar: puede ser sencilla.
            </p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          <p className="pdf-name-hint">{securePasswordRequirementsMessage()}</p>

          {error ? <p className="form-alert form-alert--error">{error}</p> : null}

          <button
            className="btn btn--primary btn--block"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : 'Guardar y continuar'}
          </button>

          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => void handleLogout()}
            disabled={submitting}
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  )
}
