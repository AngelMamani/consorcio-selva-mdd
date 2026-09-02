import { FirebaseError } from 'firebase/app'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
} from 'firebase/firestore'
import type {
  CatalogStatusPatch,
  ParsedSupply,
  Supply,
  SupplyCatalogStatus,
} from '@/domain/entities/Supply'
import { supplyHasLocation } from '@/domain/entities/Supply'
import type { ParsedSed, Sed } from '@/domain/entities/Sed'
import type { SupplyRepository } from '@/domain/repositories/SupplyRepository'
import {
  boundingBox,
  distanceMeters,
} from '@/domain/services/GeoDistanceService'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface SupplyDoc {
  routeCode: string
  latitude?: number
  longitude?: number
  prefix: string
  note?: string
  updatedAt: Timestamp
}

interface SedDoc {
  code: string
  name: string
  latitude: number
  longitude: number
  updatedAt: Timestamp
}

interface CatalogDoc {
  count: number
  sedCount: number
  skipped: number
  skippedSeds: number
  importedAt: Timestamp
  importedById: string
  importedByName: string
}

const BATCH_SIZE = 50
const BATCH_PAUSE_MS = 40

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isWriteQueueExhausted(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return false
  return (
    error.code === 'resource-exhausted' ||
    error.message.toLowerCase().includes('queued writes')
  )
}

function mapWriteError(error: unknown, fallback: string): never {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      throw new UnauthorizedError(
        'Firestore rechazó la escritura. Hay que publicar las reglas nuevas (colección supplies).',
      )
    }
    if (error.code === 'resource-exhausted') {
      throw new ValidationError(
        'Firebase alcanzó el límite de escrituras. Espera unos minutos e importa de nuevo; se puede repetir sin duplicar.',
      )
    }
    throw new ValidationError(`${fallback}: ${error.message}`)
  }
  throw error
}

function mapSupply(id: string, data: SupplyDoc): Supply {
  const latitude =
    typeof data.latitude === 'number' && Number.isFinite(data.latitude)
      ? data.latitude
      : null
  const longitude =
    typeof data.longitude === 'number' && Number.isFinite(data.longitude)
      ? data.longitude
      : null
  const hasCoords =
    latitude !== null &&
    longitude !== null &&
    !(latitude === 0 && longitude === 0)
  return {
    id,
    routeCode: data.routeCode,
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    prefix: data.prefix,
    note: (data.note ?? '').trim(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function mapSed(id: string, data: SedDoc): Sed {
  return {
    id,
    code: data.code,
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    updatedAt: data.updatedAt.toDate(),
  }
}

export class FirebaseSupplyRepository implements SupplyRepository {
  private readonly collectionRef = collection(firestoreDb, 'supplies')
  private readonly sedsRef = collection(firestoreDb, 'seds')
  private readonly catalogRef = doc(firestoreDb, 'settings', 'suppliesCatalog')

  async getByRouteCode(routeCode: string): Promise<Supply | null> {
    const snapshot = await getDoc(doc(this.collectionRef, routeCode))
    if (!snapshot.exists()) return null
    return mapSupply(snapshot.id, snapshot.data() as SupplyDoc)
  }

  async searchByPrefix(prefix: string, max: number): Promise<Supply[]> {
    const snapshot = await getDocs(
      query(
        this.collectionRef,
        where('routeCode', '>=', prefix),
        where('routeCode', '<=', `${prefix}\uf8ff`),
        orderBy('routeCode'),
        limit(max),
      ),
    )
    return snapshot.docs.map((item) =>
      mapSupply(item.id, item.data() as SupplyDoc),
    )
  }

  async listNear(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    max: number,
  ): Promise<Supply[]> {
    const box = boundingBox(latitude, longitude, radiusMeters)
    const fetchLimit = Math.min(800, Math.max(max * 3, 80))

    let docs: Supply[]
    try {
      const snapshot = await getDocs(
        query(
          this.collectionRef,
          where('latitude', '>=', box.minLat),
          where('latitude', '<=', box.maxLat),
          where('longitude', '>=', box.minLng),
          where('longitude', '<=', box.maxLng),
          limit(fetchLimit),
        ),
      )
      docs = snapshot.docs.map((item) =>
        mapSupply(item.id, item.data() as SupplyDoc),
      )
    } catch (error) {
      if (
        !(error instanceof FirebaseError) ||
        error.code !== 'failed-precondition'
      ) {
        throw error
      }
      const snapshot = await getDocs(
        query(
          this.collectionRef,
          where('latitude', '>=', box.minLat),
          where('latitude', '<=', box.maxLat),
          orderBy('latitude'),
          limit(fetchLimit),
        ),
      )
      docs = snapshot.docs.map((item) =>
        mapSupply(item.id, item.data() as SupplyDoc),
      )
    }

    return docs
      .filter(
        (supply) =>
          supplyHasLocation(supply) &&
          supply.longitude >= box.minLng &&
          supply.longitude <= box.maxLng &&
          distanceMeters(
            latitude,
            longitude,
            supply.latitude,
            supply.longitude,
          ) <= radiusMeters,
      )
      .slice(0, max)
  }

  async ensureManual(input: {
    routeCode: string
    note?: string
  }): Promise<Supply> {
    const existing = await this.getByRouteCode(input.routeCode)
    if (existing) {
      const note = (input.note ?? '').trim()
      if (note && !existing.note) {
        await updateDoc(doc(this.collectionRef, existing.id), {
          note,
          updatedAt: Timestamp.now(),
        })
        return { ...existing, note, updatedAt: new Date() }
      }
      return existing
    }

    const now = Timestamp.now()
    const payload: SupplyDoc = {
      routeCode: input.routeCode,
      prefix: input.routeCode.slice(0, 4),
      updatedAt: now,
    }
    const note = (input.note ?? '').trim()
    if (note) payload.note = note
    await setDoc(doc(this.collectionRef, input.routeCode), payload)
    return mapSupply(input.routeCode, payload)
  }

  async setLocation(
    routeCode: string,
    latitude: number,
    longitude: number,
  ): Promise<Supply> {
    const existing = await this.getByRouteCode(routeCode)
    if (!existing) {
      throw new ValidationError('No hay suministro con ese código')
    }
    if (supplyHasLocation(existing)) return existing

    const now = Timestamp.now()
    await updateDoc(doc(this.collectionRef, routeCode), {
      latitude,
      longitude,
      updatedAt: now,
    })
    return {
      ...existing,
      latitude,
      longitude,
      updatedAt: now.toDate(),
    }
  }

  async getSedByCode(code: string): Promise<Sed | null> {
    const snapshot = await getDoc(doc(this.sedsRef, code))
    if (!snapshot.exists()) return null
    return mapSed(snapshot.id, snapshot.data() as SedDoc)
  }

  async searchSedsByPrefix(prefix: string, max: number): Promise<Sed[]> {
    const snapshot = await getDocs(
      query(
        this.sedsRef,
        where('code', '>=', prefix),
        where('code', '<=', `${prefix}\uf8ff`),
        orderBy('code'),
        limit(max),
      ),
    )
    return snapshot.docs.map((item) => mapSed(item.id, item.data() as SedDoc))
  }

  async listFirstSupplies(max: number): Promise<Supply[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('routeCode'), limit(max)),
    )
    return snapshot.docs.map((item) =>
      mapSupply(item.id, item.data() as SupplyDoc),
    )
  }

  async listFirstSeds(max: number): Promise<Sed[]> {
    const snapshot = await getDocs(
      query(this.sedsRef, orderBy('code'), limit(max)),
    )
    return snapshot.docs.map((item) => mapSed(item.id, item.data() as SedDoc))
  }

  async upsertMany(
    supplies: ParsedSupply[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    const total = supplies.length
    for (let index = 0; index < total; index += BATCH_SIZE) {
      const slice = supplies.slice(index, index + BATCH_SIZE)
      await this.commitSlice(slice)
      onProgress?.(Math.min(index + slice.length, total), total)
      await sleep(BATCH_PAUSE_MS)
    }
    await waitForPendingWrites(firestoreDb)
  }

  async upsertSeds(
    seds: ParsedSed[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    const total = seds.length
    for (let index = 0; index < total; index += BATCH_SIZE) {
      const slice = seds.slice(index, index + BATCH_SIZE)
      await this.commitSedSlice(slice)
      onProgress?.(Math.min(index + slice.length, total), total)
      await sleep(BATCH_PAUSE_MS)
    }
    await waitForPendingWrites(firestoreDb)
  }

  private async commitSedSlice(slice: ParsedSed[]): Promise<void> {
    const maxAttempts = 7
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const batch = writeBatch(firestoreDb)
      const now = Timestamp.now()
      for (const sed of slice) {
        batch.set(doc(this.sedsRef, sed.code), {
          code: sed.code,
          name: sed.name,
          latitude: sed.latitude,
          longitude: sed.longitude,
          updatedAt: now,
        } satisfies SedDoc)
      }
      try {
        await batch.commit()
        await waitForPendingWrites(firestoreDb)
        return
      } catch (error) {
        if (!isWriteQueueExhausted(error) || attempt === maxAttempts - 1) {
          mapWriteError(error, 'No se pudieron guardar las SEDs')
        }
        await sleep(400 * 2 ** attempt)
      }
    }
  }

  private async commitSlice(slice: ParsedSupply[]): Promise<void> {
    const maxAttempts = 7
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const batch = writeBatch(firestoreDb)
      const now = Timestamp.now()
      for (const supply of slice) {
        batch.set(doc(this.collectionRef, supply.routeCode), {
          routeCode: supply.routeCode,
          latitude: supply.latitude,
          longitude: supply.longitude,
          prefix: supply.routeCode.slice(0, 4),
          updatedAt: now,
        } satisfies SupplyDoc)
      }
      try {
        await batch.commit()
        await waitForPendingWrites(firestoreDb)
        return
      } catch (error) {
        if (!isWriteQueueExhausted(error) || attempt === maxAttempts - 1) {
          mapWriteError(error, 'No se pudieron guardar las estaciones')
        }
        await sleep(400 * 2 ** attempt)
      }
    }
  }

  async getCatalogStatus(): Promise<SupplyCatalogStatus | null> {
    const snapshot = await getDoc(this.catalogRef)
    if (!snapshot.exists()) return null
    const data = snapshot.data() as CatalogDoc
    return {
      count: data.count ?? 0,
      sedCount: data.sedCount ?? 0,
      skipped: data.skipped ?? 0,
      skippedSeds: data.skippedSeds ?? 0,
      importedAt: data.importedAt.toDate(),
      importedById: data.importedById,
      importedByName: data.importedByName,
    }
  }

  async saveCatalogStatus(
    status: CatalogStatusPatch,
  ): Promise<SupplyCatalogStatus> {
    const current = await this.getCatalogStatus()
    const importedAt = Timestamp.now()
    const merged: SupplyCatalogStatus = {
      count: status.count ?? current?.count ?? 0,
      sedCount: status.sedCount ?? current?.sedCount ?? 0,
      skipped: status.skipped ?? current?.skipped ?? 0,
      skippedSeds: status.skippedSeds ?? current?.skippedSeds ?? 0,
      importedAt: importedAt.toDate(),
      importedById: status.importedById,
      importedByName: status.importedByName,
    }
    const payload: CatalogDoc = {
      count: merged.count,
      sedCount: merged.sedCount,
      skipped: merged.skipped,
      skippedSeds: merged.skippedSeds,
      importedAt,
      importedById: merged.importedById,
      importedByName: merged.importedByName,
    }
    try {
      await setDoc(this.catalogRef, payload)
    } catch (error) {
      mapWriteError(error, 'Los datos se guardaron, pero no el resumen del catálogo')
    }
    return merged
  }
}
