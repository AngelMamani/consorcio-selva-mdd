import { getBlob, ref } from 'firebase/storage'
import { DomainError } from '@/domain/errors/DomainError'
import {
  firebaseAuth,
  firebaseStorage,
} from '@/infrastructure/firebase/firebaseApp'
import { loadFirebaseConfig } from '@/infrastructure/firebase/firebaseConfig'

/**
 * Descarga un objeto de Storage con la sesión actual.
 * - En desarrollo: proxy Vite (`/__firebase_storage`) + Bearer token → sin CORS.
 * - En producción: SDK `getBlob` (requiere CORS del bucket).
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

  if (import.meta.env.DEV) {
    const token = await user.getIdToken()
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

  try {
    return await getBlob(ref(firebaseStorage, path))
  } catch {
    throw new DomainError('No se pudo leer el archivo en Storage')
  }
}
