import { useEffect, useState, type FormEvent } from 'react'
import type { MobileAppRelease } from '@/domain/entities/MobileAppRelease'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { swalError, swalSuccess } from '@/presentation/utils/appSwal'
import { readApkReleaseVersion } from '@/presentation/utils/readApkReleaseVersion'
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
  const [readingApk, setReadingApk] = useState(false)
  const [progress, setProgress] = useState(0)
  const [versionName, setVersionName] = useState('')
  const [versionCode, setVersionCode] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [forceUpdate, setForceUpdate] = useState(false)
  const [apkFile, setApkFile] = useState<File | null>(null)
  const [apkHint, setApkHint] = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const release = await getMobileAppReleaseUseCase.execute(user)
      setCurrent(release)
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

  async function handleApkSelected(file: File | null) {
    setApkFile(file)
    setVersionName('')
    setVersionCode(null)
    setApkHint('')
    if (!file) return

    setReadingApk(true)
    try {
      const meta = await readApkReleaseVersion(file)
      setVersionName(meta.versionName)
      setVersionCode(meta.versionCode)

      if (current && meta.versionCode <= current.versionCode) {
        setApkHint(
          `Este APK trae código ${meta.versionCode}, pero ya publicaste ${current.versionCode}. Genera un APK nuevo con código mayor.`,
        )
      } else {
        setApkHint(
          `Leído del APK: ${meta.versionName} · código ${meta.versionCode}`,
        )
      }
    } catch (err) {
      setApkFile(null)
      setApkHint('')
      swalError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer la versión del APK',
      )
    } finally {
      setReadingApk(false)
    }
  }

  async function handlePublish(event: FormEvent) {
    event.preventDefault()
    if (!user || publishing || readingApk) return
    if (!apkFile || !versionName || versionCode == null) {
      swalError('Elige el APK; la versión se lee sola')
      return
    }
    if (current && versionCode <= current.versionCode) {
      swalError(
        `Este APK trae código ${versionCode}. Debe ser mayor que ${current.versionCode}.`,
      )
      return
    }

    setPublishing(true)
    setProgress(0)
    try {
      const buffer = await apkFile.arrayBuffer()
      const published = await publishMobileAppReleaseUseCase.execute(user, {
        versionName,
        versionCode,
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
      setVersionCode(null)
      setApkHint('')
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

  const canPublish =
    Boolean(apkFile && versionName && versionCode != null) &&
    !readingApk &&
    !(current && versionCode != null && versionCode <= current.versionCode)

  return (
    <section className="mobile-app-page">
      <header className="mobile-app-page__header">
        <div>
          <p className="mobile-app-page__eyebrow">App de técnicos</p>
          <h2>Actualización del APK</h2>
          <p>
            Sube el APK y la <strong>versión</strong> y el <strong>código</strong> se
            leen solos del archivo. Así no hay desfase con lo que tiene el celular.
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
              <dd>
                {current.forceUpdate
                  ? 'Sí, no se puede omitir'
                  : 'No, pueden seguir por ahora'}
              </dd>
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
            Todavía no hay una versión publicada. Sube el APK de release.
          </p>
        )}
      </article>

      <form
        className="mobile-app-form"
        onSubmit={(event) => void handlePublish(event)}
      >
        <h3>Publicar nueva versión</h3>

        <label className="field">
          <span>Archivo APK</span>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) =>
              void handleApkSelected(event.target.files?.[0] ?? null)
            }
            required={!apkFile}
            disabled={publishing || readingApk}
          />
          {readingApk ? <em>Leyendo versión del APK…</em> : null}
          {apkFile && !readingApk ? (
            <em>
              {apkFile.name} · {(apkFile.size / (1024 * 1024)).toFixed(1)} MB
            </em>
          ) : null}
          {apkHint ? (
            <em
              className={
                current &&
                versionCode != null &&
                versionCode <= current.versionCode
                  ? 'mobile-app-hint mobile-app-hint--warn'
                  : 'mobile-app-hint'
              }
            >
              {apkHint}
            </em>
          ) : null}
        </label>

        <div className="mobile-app-auto">
          <div>
            <span>Versión (automática)</span>
            <strong>{versionName || '—'}</strong>
          </div>
          <div>
            <span>Código (automático)</span>
            <strong>{versionCode ?? '—'}</strong>
          </div>
        </div>

        <label className="field">
          <span>Qué hay de nuevo (opcional)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Tareas por GPS, suministros cercanos..."
          />
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
          disabled={publishing || readingApk || !canPublish}
        >
          {publishing
            ? 'Publicando...'
            : readingApk
              ? 'Leyendo APK...'
              : 'Publicar APK'}
        </button>
      </form>
    </section>
  )
}
