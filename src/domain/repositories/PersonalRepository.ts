import type {
  Personal,
  PersonalInput,
} from '@/domain/entities/Personal'

export interface PersonalWriteInput extends PersonalInput {
  cargoName: string
  localidadName: string
  roleName: string
  createdById: string
  createdByName: string
}

export interface PersonalRepository {
  listAll(): Promise<Personal[]>
  getById(id: string): Promise<Personal | null>
  findByDni(dni: string): Promise<Personal | null>
  create(input: PersonalWriteInput): Promise<Personal>
  update(id: string, input: PersonalWriteInput): Promise<Personal>
  delete(id: string): Promise<void>
  countByCargoId(cargoId: string): Promise<number>
  countByLocalidadId(localidadId: string): Promise<number>
  renameCargo(cargoId: string, cargoName: string): Promise<void>
  renameLocalidad(localidadId: string, localidadName: string): Promise<void>
}
