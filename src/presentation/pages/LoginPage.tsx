import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'
import loginBg from '@/assets/img-login.png'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { DomainError } from '@/domain/errors/DomainError'
import './LoginPage.css'

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="password-toggle__icon">
      <path
        fill="currentColor"
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
      />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="password-toggle__icon">
      <path
        fill="currentColor"
        d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
      />
    </svg>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { loginUseCase } = useDependencies()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const user = await loginUseCase.execute({ identifier: email, password })
      setUser(user)
      navigate(user.mustChangePassword ? '/cambiar-contrasena' : '/carpetas', {
        replace: true,
      })
    } catch (err) {
      const message =
        err instanceof DomainError
          ? err.message
          : 'No se pudo iniciar sesión. Intenta nuevamente.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <div
        className="login-page__backdrop"
        style={{ backgroundImage: `url(${loginBg})` }}
        aria-hidden="true"
      />
      <div className="login-page__veil" aria-hidden="true" />

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__brand">
          <img src={logo} alt="Consorcio Selva MDD" className="login-card__logo" />
          <div>
            <p className="login-card__eyebrow">Sistema administrativo</p>
            <h1 id="login-title">Consorcio Selva MDD</h1>
            <p className="login-card__subtitle">
              Acceso seguro para administradores y técnicos
            </p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Correo o código (DNI)</span>
            <input
              type="text"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.com o 00000000"
              required
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Ver contraseña'
                }
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </label>

          {error ? <p className="form-alert form-alert--error">{error}</p> : null}

          <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="login-card__footer">
          Servicios eléctricos · Madre de Dios, Perú
        </p>
      </section>
    </main>
  )
}
