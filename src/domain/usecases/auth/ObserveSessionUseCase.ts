import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import {
  CONFIGURED_SUPER_ADMIN_EMAIL,
  UserRole,
} from '@/domain/value-objects/UserRole'

export class ObserveSessionUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  execute(onChange: (user: User | null) => void): () => void {
    return this.authRepository.observeAuthState((userId) => {
      void (async () => {
        if (!userId) {
          onChange(null)
          return
        }

        let user = await this.userRepository.getById(userId)
        if (!user || !user.active) {
          await this.authRepository.logout()
          onChange(null)
          return
        }

        if (
          user.email === CONFIGURED_SUPER_ADMIN_EMAIL &&
          user.role !== UserRole.SuperAdministrador
        ) {
          try {
            await this.authRepository.claimConfiguredSuperAdmin()
            user =
              (await this.userRepository.getById(userId)) ?? {
                ...user,
                role: UserRole.SuperAdministrador,
              }
          } catch {
            // Si la función aún no está desplegada, el siguiente ingreso lo reintenta.
          }
        }

        onChange(user)
      })()
    })
  }
}
