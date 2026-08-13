import type { AuthRepository } from '@/domain/repositories/AuthRepository'

export class LogoutUseCase {
  private readonly authRepository: AuthRepository

  constructor(authRepository: AuthRepository) {
    this.authRepository = authRepository
  }

  async execute(): Promise<void> {
    await this.authRepository.logout()
  }
}
