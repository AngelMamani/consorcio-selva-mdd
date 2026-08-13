import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'
import loginBg from '@/assets/img-login.png'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { DomainError } from '@/domain/errors/DomainError'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { loginUseCase } = useDependencies()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('amamanim@unamad.edu.pe')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const user = await loginUseCase.execute({ email, password })
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
            <span>Correo electrónico</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.com"
              required
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
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
