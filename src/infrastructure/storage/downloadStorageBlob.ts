import { getBlob, ref } from 'firebase/storage'
import { DomainError } from '@/domain/errors/DomainError'
import {
  firebaseAuth,
  firebaseStorage,
} from '@/infrastructure/firebase/firebaseApp'
import { loadFirebaseConfig } from '@/infrastructure/firebase/firebaseConfig'

/**
 * Descarga un objeto de Storage con la sesión actual.
 * - DEV: proxy Vite (`/__firebase_storage`) + Bearer → sin CORS.
 * - PROD (Vercel): proxy `/api/storage` + Bearer → sin CORS.
 * - Fallback: SDK `getBlob` (requiere CORS del bucket).
 */
export async function downloadStorageBlob(storagePath: string): Promise<Blob> {
  const path = storagePath.trim()
  if (!path) {
    throw new DomainError('Ruta de Storage inválida')
  }

  const user = firebaseAuth.currentUser
  if (!user) {
    throw new DomainError('Debes iniciar sesión para leer archivos')
  }

  const token = await user.getIdToken()

  if (import.meta.env.DEV) {
    const { storageBucket } = loadFirebaseConfig()
    const objectPath = encodeURIComponent(path)
    const response = await fetch(
      `/__firebase_storage/v0/b/${storageBucket}/o/${objectPath}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (!response.ok) {
      throw new DomainError(
        `No se pudo leer el archivo en Storage (${response.status})`,
      )
    }

    return response.blob()
  }

  // Producción en Vercel: evita CORS del bucket.
  try {
    const response = await fetch(
      `/api/storage?path=${encodeURIComponent(path)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (response.ok) {
      return response.blob()
    }
  } catch {
    // Continúa con getBlob si el proxy no está disponible.
  }

  try {
    return await getBlob(ref(firebaseStorage, path))
  } catch {
    throw new DomainError('No se pudo leer el archivo en Storage')
  }
}
