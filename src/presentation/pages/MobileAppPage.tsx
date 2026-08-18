import { useEffect, useState, type FormEvent } from 'react'
import type { MobileAppRelease } from '@/domain/entities/MobileAppRelease'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError, swalSuccess } from '@/presentation/utils/appSwal'
import './MobileAppPage.css'

function formatWhen(date: Date): string {
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function MobileAppPage() {
  const { user } = useAuth()
  const { getMobileAppReleaseUseCase, publishMobileAppReleaseUseCase } =
    useDependencies()

  const [current, setCurrent] = useState<MobileAppRelease | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [versionName, setVersionName] = useState('')
  const [versionCode, setVersionCode] = useState('')
  const [notes, setNotes] = useState('')
  const [forceUpdate, setForceUpdate] = useState(false)
  const [apkFile, setApkFile] = useState<File | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const release = await getMobileAppReleaseUseCase.execute(user)
      setCurrent(release)
      if (release) {
        setVersionCode(String(release.versionCode + 1))
      } else {
        setVersionCode('5')
      }
    } catch (err) {
      swalError(
        err instanceof DomainError
          ? err.message
          : 'No se pudo cargar la versión publicada',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handlePublish(event: FormEvent) {
    event.preventDefault()
    if (!user || publishing) return
    if (!apkFile) {
      swalError('Elige el archivo APK')
      return
    }

    setPublishing(true)
    setProgress(0)
    try {
      const buffer = await apkFile.arrayBuffer()
      const published = await publishMobileAppReleaseUseCase.execute(user, {
        versionName,
        versionCode: Number(versionCode),
        notes,
        forceUpdate,
        apkFileName: apkFile.name,
        apkContentType: apkFile.type,
        apkBytes: new Uint8Array(buffer),
        onProgress: (ratio) => setProgress(ratio),
      })
      setCurrent(published)
      setApkFile(null)
      setNotes('')
      setForceUpdate(false)
      setVersionName('')
      setVersionCode(String(published.versionCode + 1))
      swalSuccess(`Publicada ${published.versionName} (${published.versionCode})`)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo publicar el APK',
      )
    } finally {
      setPublishing(false)
      setProgress(0)
    }
  }

  return (
    <section className="mobile-app-page">
      <header className="mobile-app-page__header">
        <div>
          <p className="mobile-app-page__eyebrow">App de técnicos</p>
          <h2>Actualización del APK</h2>
          <p>
            El aviso solo aparece si el celular tiene un <strong>código menor</strong> al
            publicado. Si ya instalaste la misma versión, no sale nada.
          </p>
        </div>
      </header>

      <article className="mobile-app-card">
        <h3>Versión en los celulares</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : current ? (
          <dl className="mobile-app-meta">
            <div>
              <dt>Versión</dt>
              <dd>
                {current.versionName} · código {current.versionCode}
              </dd>
            </div>
            <div>
              <dt>Publicada</dt>
              <dd>
                {formatWhen(current.updatedAt)} por {current.updatedByName}
              </dd>
            </div>
            <div>
              <dt>Obligatoria</dt>
              <dd>{current.forceUpdate ? 'Sí, no se puede omitir' : 'No, pueden seguir por ahora'}</dd>
            </div>
            {current.notes ? (
              <div>
                <dt>Notas</dt>
                <dd>{current.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p>
            Todavía no hay una versión publicada. Sube el APK que ya incluye el
            aviso de actualización.
          </p>
        )}
      </article>

      <form className="mobile-app-form" onSubmit={(event) => void handlePublish(event)}>
        <h3>Publicar nueva versión</h3>
        <label className="field">
          <span>Versión visible</span>
          <input
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="1.2.2"
            required
          />
        </label>
        <label className="field">
          <span>Código (entero, siempre mayor al anterior)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={versionCode}
            onChange={(event) => setVersionCode(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Qué hay de nuevo (opcional)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Asistencia de campo sin área, foto opcional..."
          />
        </label>
        <label className="field">
          <span>Archivo APK</span>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => setApkFile(event.target.files?.[0] ?? null)}
            required={!apkFile}
          />
          {apkFile ? (
            <em>
              {apkFile.name} · {(apkFile.size / (1024 * 1024)).toFixed(1)} MB
            </em>
          ) : null}
        </label>
        <label className="mobile-app-check">
          <input
            type="checkbox"
            checked={forceUpdate}
            onChange={(event) => setForceUpdate(event.target.checked)}
          />
          Obligar a actualizar (no pueden omitir el aviso)
        </label>
        {publishing ? (
          <p className="mobile-app-progress">
            Subiendo APK... {Math.round(progress * 100)}%
          </p>
        ) : null}
        <button
          type="submit"
          className="btn btn--soft-primary"
          disabled={publishing}
        >
          {publishing ? 'Publicando...' : 'Publicar APK'}
        </button>
      </form>
    </section>
  )
}
