import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'

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

        const user = await this.userRepository.getById(userId)
        if (!user || !user.active) {
          // Cierra la sesión Auth si el perfil no existe o está inactivo.
          await this.authRepository.logout()
          onChange(null)
          return
        }

        onChange(user)
      })()
    })
  }
}
