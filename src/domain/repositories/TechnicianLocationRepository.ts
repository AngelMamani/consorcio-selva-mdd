import type { TechnicianLocation } from '@/domain/entities/TechnicianLocation'
import type { TechnicianRoutePoint } from '@/domain/entities/TechnicianRoutePoint'

export interface TechnicianLocationRepository {
  watchAll(
    onData: (locations: TechnicianLocation[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  watchRoute(
    userId: string,
    dateKey: string,
    onData: (points: TechnicianRoutePoint[]) => void,
    onError?: (error: Error) => void,
  ): () => void
}
