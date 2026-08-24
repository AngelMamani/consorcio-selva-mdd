import type { OperationalRole } from '@/domain/entities/OperationalRole'

export interface OperationalRoleRepository {
  listAll(): Promise<OperationalRole[]>
  getById(id: string): Promise<OperationalRole | null>
  getByCode(code: string): Promise<OperationalRole | null>
  create(input: {
    name: string
    code: string
    permissions: string[]
    isSystem: boolean
    createdById: string
    createdByName: string
  }): Promise<OperationalRole>
  update(
    id: string,
    input: { name: string; permissions: string[] },
  ): Promise<OperationalRole>
  delete(id: string): Promise<void>
  countUsersByRoleCode(code: string): Promise<number>
}
