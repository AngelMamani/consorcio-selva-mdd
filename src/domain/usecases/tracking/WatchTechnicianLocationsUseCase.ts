import type { User } from '@/domain/entities/User'
import type { TechnicianLocation } from '@/domain/entities/TechnicianLocation'
import type { TechnicianLocationRepository } from '@/domain/repositories/TechnicianLocationRepository'
import { UnauthorizedError } from '@/domain/errors/DomainError'
import { UserRole } from '@/domain/value-objects/UserRole'

export class WatchTechnicianLocationsUseCase {
  private readonly repository: TechnicianLocationRepository

  constructor(repository: TechnicianLocationRepository) {
    this.repository = repository
  }

  watch(
    actor: User,
    onData: (locations: TechnicianLocation[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    if (!actor.active || actor.role !== UserRole.SuperAdministrador) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede ver el seguimiento',
      )
    }
    return this.repository.watchAll(onData, onError)
  }
}
