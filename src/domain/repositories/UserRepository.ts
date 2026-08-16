import type { User } from '@/domain/entities/User'
import type { UserRole } from '@/domain/value-objects/UserRole'
import type { ThemePreference } from '@/domain/value-objects/ThemePreference'

export interface CreateUserInput {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface UpdateUserInput {
  displayName?: string
  role?: UserRole
  active?: boolean
  theme?: ThemePreference
  mustChangePassword?: boolean
}

export interface UserRepository {
  getById(id: string): Promise<User | null>
  listAll(): Promise<User[]>
  listTechnicians(): Promise<User[]>
  create(input: CreateUserInput): Promise<User>
  update(id: string, input: UpdateUserInput): Promise<User>
}
