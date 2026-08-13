export interface AuthCredentials {
  email: string
  password: string
}

export interface CreateManagedUserInput {
  email: string
  displayName: string
  role: string
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
  login(credentials: AuthCredentials): Promise<string>
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
