import type { PersonalCondition } from '@/domain/value-objects/PersonalCondition'

export interface Personal {
  id: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
  cargoId: string
  cargoName: string
  localidadId: string
  localidadName: string
  condicion: PersonalCondition | ''
  roleId: string
  roleName: string
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export function personalFullName(person: Pick<
  Personal,
  'nombres' | 'apellidoPaterno' | 'apellidoMaterno'
>): string {
  return `${person.nombres} ${person.apellidoPaterno} ${person.apellidoMaterno}`
    .replace(/\s+/g, ' ')
    .trim()
}

export interface PersonalInput {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
  cargoId: string
  localidadId: string
  condicion: PersonalCondition | ''
  roleId: string
}

export interface ParsedPersonalRow {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
  cargoName: string
  localidadName: string
  condicion: PersonalCondition | ''
}

export interface PersonalImportResult {
  count: number
  created: number
  updated: number
  skipped: number
  cargosCreated: number
  localidadesCreated: number
}
