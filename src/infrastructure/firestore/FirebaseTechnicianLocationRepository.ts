import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import type { TechnicianLocation } from '@/domain/entities/TechnicianLocation'
import type { TechnicianRoutePoint } from '@/domain/entities/TechnicianRoutePoint'
import { limaDayBounds } from '@/domain/entities/TechnicianRoutePoint'
import type { TechnicianLocationRepository } from '@/domain/repositories/TechnicianLocationRepository'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface LocationDoc {
  userId?: string
  displayName?: string
  latitude?: number
  longitude?: number
  accuracyMeters?: number | null
  gpsActive?: boolean
  updatedAt?: { toDate(): Date }
}

interface RoutePointDoc {
  latitude?: number
  longitude?: number
  accuracyMeters?: number | null
  capturedAt?: { toDate(): Date }
}

function mapRoutePoint(data: RoutePointDoc): TechnicianRoutePoint | null {
  const latitude = data.latitude
  const longitude = data.longitude
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null
  }
  return {
    latitude,
    longitude,
    accuracyMeters:
      typeof data.accuracyMeters === 'number' ? data.accuracyMeters : null,
    capturedAt: data.capturedAt?.toDate() ?? new Date(0),
  }
}

function mapLocation(id: string, data: LocationDoc): TechnicianLocation | null {
  const latitude = data.latitude
  const longitude = data.longitude
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null
  }
  return {
    userId: data.userId || id,
    displayName: (data.displayName ?? '').trim() || 'Técnico',
    latitude,
    longitude,
    accuracyMeters:
      typeof data.accuracyMeters === 'number' ? data.accuracyMeters : null,
    gpsActive: data.gpsActive === true,
    updatedAt: data.updatedAt?.toDate() ?? new Date(0),
  }
}

export class FirebaseTechnicianLocationRepository
  implements TechnicianLocationRepository
{
  private readonly collectionRef = collection(firestoreDb, 'technicianLocations')

  watchAll(
    onData: (locations: TechnicianLocation[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.collectionRef),
      (snapshot) => {
        const locations = snapshot.docs
          .map((item) => mapLocation(item.id, item.data() as LocationDoc))
          .filter((item): item is TechnicianLocation => item !== null)
          .sort((left, right) =>
            left.displayName.localeCompare(right.displayName, 'es'),
          )
        onData(locations)
      },
      (error) => onError?.(error),
    )
  }

  watchRoute(
    userId: string,
    dateKey: string,
    onData: (points: TechnicianRoutePoint[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const { start, end } = limaDayBounds(dateKey)
    return onSnapshot(
      query(
        collection(this.collectionRef, userId, 'routePoints'),
        where('capturedAt', '>=', start),
        where('capturedAt', '<', end),
        orderBy('capturedAt'),
      ),
      (snapshot) => {
        const points = snapshot.docs
          .map((item) => mapRoutePoint(item.data() as RoutePointDoc))
          .filter((item): item is TechnicianRoutePoint => item !== null)
        onData(points)
      },
      (error) => onError?.(error),
    )
  }
}
