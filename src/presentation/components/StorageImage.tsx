import { useEffect, useState, type ReactNode } from 'react'
import { downloadStorageBlob } from '@/infrastructure/storage/downloadStorageBlob'
import './StorageImage.css'

interface StorageImageProps {
  storagePath: string
  alt: string
  className?: string
  imageClassName?: string
  openOnClick?: boolean
  overlay?: ReactNode
}

export function StorageImage({
  storagePath,
  alt,
  className,
  imageClassName,
  openOnClick = false,
  overlay,
}: StorageImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null

    setObjectUrl(null)
    setFailed(false)

    void (async () => {
      try {
        const blob = await downloadStorageBlob(storagePath)
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [storagePath])

  if (failed) {
    return (
      <div className={`storage-image storage-image--failed ${className ?? ''}`}>
        No se pudo cargar
      </div>
    )
  }

  if (!objectUrl) {
    return (
      <div className={`storage-image storage-image--loading ${className ?? ''}`}>
        <span className="storage-image__spinner" />
      </div>
    )
  }

  const content = (
    <>
      <img className={imageClassName} src={objectUrl} alt={alt} loading="lazy" />
      {overlay}
    </>
  )

  if (!openOnClick) {
    return <div className={className}>{content}</div>
  }

  return (
    <a
      className={className}
      href={objectUrl}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  )
}
