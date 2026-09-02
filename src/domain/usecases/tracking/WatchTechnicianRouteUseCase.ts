import type { User } from '@/domain/entities/User'
import type { TechnicianRoutePoint } from '@/domain/entities/TechnicianRoutePoint'
import type { TechnicianLocationRepository } from '@/domain/repositories/TechnicianLocationRepository'
import { UnauthorizedError } from '@/domain/errors/DomainError'
import { UserRole } from '@/domain/value-objects/UserRole'

export class WatchTechnicianRouteUseCase {
  private readonly repository: TechnicianLocationRepository

  constructor(repository: TechnicianLocationRepository) {
    this.repository = repository
  }

  watch(
    actor: User,
    userId: string,
    dateKey: string,
    onData: (points: TechnicianRoutePoint[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    if (!actor.active || actor.role !== UserRole.SuperAdministrador) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede ver el recorrido',
      )
    }
    return this.repository.watchRoute(userId, dateKey, onData, onError)
  }
}
