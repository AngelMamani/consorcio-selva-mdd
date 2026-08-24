export interface AuthCredentials {
  identifier: string
  password: string
}

export interface CreateManagedUserInput {
  email: string
  displayName: string
  role: string
  dni?: string
}

export interface CreateManagedUserResult {
  userId: string
  temporaryPassword: string
}

export interface UpdateManagedUserDisplayNameInput {
  userId: string
  displayName: string
}

export interface AuthRepository {
  login(email: string, password: string): Promise<string>
  resolveEmailByDni(dni: string): Promise<string>
  claimConfiguredSuperAdmin(): Promise<void>
  logout(): Promise<void>
  getCurrentUserId(): Promise<string | null>
  observeAuthState(onChange: (userId: string | null) => void): () => void
  createManagedUser(
    input: CreateManagedUserInput,
  ): Promise<CreateManagedUserResult>
  updateManagedUserDisplayName(
    input: UpdateManagedUserDisplayNameInput,
  ): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  resetTemporaryPassword(userId: string): Promise<string>
}
