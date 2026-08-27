import type { User } from '@/domain/entities/User'
import type { UserRole } from '@/domain/value-objects/UserRole'
import type { ThemePreference } from '@/domain/value-objects/ThemePreference'

export interface CreateUserInput {
  id: string
  email: string
  displayName: string
  role: UserRole
  roles?: UserRole[]
  dni?: string
}

export interface UpdateUserInput {
  displayName?: string
  role?: UserRole
  roles?: UserRole[]
  dni?: string
  active?: boolean
  theme?: ThemePreference
  mustChangePassword?: boolean
}

export interface UserRepository {
  getById(id: string): Promise<User | null>
  listAll(): Promise<User[]>
  listTechnicians(): Promise<User[]>
  listByDni(dni: string): Promise<User[]>
  findByDni(dni: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(input: CreateUserInput): Promise<User>
  update(id: string, input: UpdateUserInput): Promise<User>
}
