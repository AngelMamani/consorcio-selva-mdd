import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { CatalogItem } from '@/domain/entities/CatalogItem'
import type {
  ParsedPersonalRow,
  Personal,
  PersonalImportResult,
  PersonalInput,
} from '@/domain/entities/Personal'
import { personalFullName } from '@/domain/entities/Personal'
import type { CatalogRepository } from '@/domain/repositories/CatalogRepository'
import type { PersonalRepository } from '@/domain/repositories/PersonalRepository'
import type { OperationalRoleRepository } from '@/domain/repositories/OperationalRoleRepository'
import {
  isPersonalCondition,
  type PersonalCondition,
} from '@/domain/value-objects/PersonalCondition'
import { isElectricistaTechnicianCargo } from '@/domain/value-objects/TechnicianLogin'
import {
  canManageOperationalRoles,
  UserRole,
} from '@/domain/value-objects/UserRole'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

const DNI_RE = /^\d{8}$/

function normalizeText(value: string, label: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    throw new ValidationError(`${label} es obligatorio`)
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${label} no debe superar ${max} caracteres`)
  }
  return trimmed.toUpperCase()
}

function normalizeDni(value: string): string {
  const dni = value.replace(/\D/g, '')
  if (!DNI_RE.test(dni)) {
    throw new ValidationError('El DNI debe tener 8 dígitos')
  }
  return dni
}

function normalizeCondition(value: string): PersonalCondition | '' {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return ''
  if (!isPersonalCondition(trimmed)) {
    throw new ValidationError('La condición no es válida')
  }
  return trimmed
}

async function technicianRoleForCargo(
  roleRepository: OperationalRoleRepository,
  cargoName: string,
  fallback: { roleId: string; roleName: string },
): Promise<{ roleId: string; roleName: string }> {
  if (fallback.roleId) return fallback
  if (!isElectricistaTechnicianCargo(cargoName)) return fallback
  const tecnico = await roleRepository.getByCode(UserRole.Tecnico)
  if (!tecnico) return fallback
  return { roleId: tecnico.id, roleName: tecnico.name }
}

function assertCanAssignOperationalRole(actor: User, code: string): void {
  if (
    code === UserRole.SuperAdministrador &&
    !canManageOperationalRoles(actor.role)
  ) {
    throw new ValidationError(
      'Solo el Super Administrador puede asignar Super Administrador',
    )
  }
}

export class ListPersonalUseCase {
  private readonly personalRepository: PersonalRepository

  constructor(personalRepository: PersonalRepository) {
    this.personalRepository = personalRepository
  }

  async execute(actor: User): Promise<Personal[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    const people = await this.personalRepository.listAll()
    return people.sort((left, right) =>
      personalFullName(left).localeCompare(personalFullName(right), 'es'),
    )
  }
}

export class CreatePersonalUseCase {
  private readonly personalRepository: PersonalRepository
  private readonly cargoRepository: CatalogRepository
  private readonly localidadRepository: CatalogRepository
  private readonly roleRepository: OperationalRoleRepository

  constructor(
    personalRepository: PersonalRepository,
    cargoRepository: CatalogRepository,
    localidadRepository: CatalogRepository,
    roleRepository: OperationalRoleRepository,
  ) {
    this.personalRepository = personalRepository
    this.cargoRepository = cargoRepository
    this.localidadRepository = localidadRepository
    this.roleRepository = roleRepository
  }

  async execute(actor: User, input: PersonalInput): Promise<Personal> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede crear personal')
    }
    const payload = await this.buildPayload(input, actor)
    const duplicate = await this.personalRepository.findByDni(payload.dni)
    if (duplicate) {
      throw new ValidationError('Ya existe una persona con ese DNI')
    }
    return this.personalRepository.create(payload)
  }

  private async resolveRole(roleId: string): Promise<{
    roleId: string
    roleName: string
    code: string
  }> {
    const trimmed = roleId.trim()
    if (!trimmed) {
      return { roleId: '', roleName: '', code: '' }
    }
    const role = await this.roleRepository.getById(trimmed)
    if (!role) {
      throw new ValidationError('Selecciona un rol válido')
    }
    return { roleId: role.id, roleName: role.name, code: role.code }
  }

  private async buildPayload(input: PersonalInput, actor: User) {
    const dni = normalizeDni(input.dni)
    const cargo = await this.cargoRepository.getById(input.cargoId)
    if (!cargo) {
      throw new ValidationError('Selecciona un cargo')
    }
    const localidad = await this.localidadRepository.getById(input.localidadId)
    if (!localidad) {
      throw new ValidationError('Selecciona una localidad')
    }
    const selected = await this.resolveRole(input.roleId)
    assertCanAssignOperationalRole(actor, selected.code)
    const role = await technicianRoleForCargo(
      this.roleRepository,
      cargo.name,
      selected,
    )
    return {
      nombres: normalizeText(input.nombres, 'Nombres', 80),
      apellidoPaterno: normalizeText(input.apellidoPaterno, 'Apellido paterno', 60),
      apellidoMaterno: normalizeText(input.apellidoMaterno, 'Apellido materno', 60),
      dni,
      cargoId: cargo.id,
      cargoName: cargo.name,
      localidadId: localidad.id,
      localidadName: localidad.name,
      condicion: normalizeCondition(input.condicion),
      roleId: role.roleId,
      roleName: role.roleName,
      createdById: actor.id,
      createdByName: actor.displayName,
    }
  }
}

export class UpdatePersonalUseCase {
  private readonly personalRepository: PersonalRepository
  private readonly cargoRepository: CatalogRepository
  private readonly localidadRepository: CatalogRepository
  private readonly roleRepository: OperationalRoleRepository

  constructor(
    personalRepository: PersonalRepository,
    cargoRepository: CatalogRepository,
    localidadRepository: CatalogRepository,
    roleRepository: OperationalRoleRepository,
  ) {
    this.personalRepository = personalRepository
    this.cargoRepository = cargoRepository
    this.localidadRepository = localidadRepository
    this.roleRepository = roleRepository
  }

  async execute(
    actor: User,
    id: string,
    input: PersonalInput,
  ): Promise<Personal> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede editar personal')
    }
    const current = await this.personalRepository.getById(id)
    if (!current) {
      throw new NotFoundError('Persona no encontrada')
    }
    const dni = normalizeDni(input.dni)
    const duplicate = await this.personalRepository.findByDni(dni)
    if (duplicate && duplicate.id !== id) {
      throw new ValidationError('Ya existe una persona con ese DNI')
    }
    const cargo = await this.cargoRepository.getById(input.cargoId)
    if (!cargo) {
      throw new ValidationError('Selecciona un cargo')
    }
    const localidad = await this.localidadRepository.getById(input.localidadId)
    if (!localidad) {
      throw new ValidationError('Selecciona una localidad')
    }
    const selected = await this.resolveRole(input.roleId)
    assertCanAssignOperationalRole(actor, selected.code)
    const role = await technicianRoleForCargo(
      this.roleRepository,
      cargo.name,
      selected,
    )
    return this.personalRepository.update(id, {
      nombres: normalizeText(input.nombres, 'Nombres', 80),
      apellidoPaterno: normalizeText(input.apellidoPaterno, 'Apellido paterno', 60),
      apellidoMaterno: normalizeText(input.apellidoMaterno, 'Apellido materno', 60),
      dni,
      cargoId: cargo.id,
      cargoName: cargo.name,
      localidadId: localidad.id,
      localidadName: localidad.name,
      condicion: normalizeCondition(input.condicion),
      roleId: role.roleId,
      roleName: role.roleName,
      createdById: current.createdById,
      createdByName: current.createdByName,
    })
  }

  private async resolveRole(roleId: string): Promise<{
    roleId: string
    roleName: string
    code: string
  }> {
    const trimmed = roleId.trim()
    if (!trimmed) {
      return { roleId: '', roleName: '', code: '' }
    }
    const role = await this.roleRepository.getById(trimmed)
    if (!role) {
      throw new ValidationError('Selecciona un rol válido')
    }
    return { roleId: role.id, roleName: role.name, code: role.code }
  }
}

export class DeletePersonalUseCase {
  private readonly personalRepository: PersonalRepository

  constructor(personalRepository: PersonalRepository) {
    this.personalRepository = personalRepository
  }

  async execute(actor: User, id: string): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede eliminar personal')
    }
    await this.personalRepository.delete(id)
  }
}

export class ImportPersonalUseCase {
  private readonly personalRepository: PersonalRepository
  private readonly cargoRepository: CatalogRepository
  private readonly localidadRepository: CatalogRepository
  private readonly roleRepository: OperationalRoleRepository

  constructor(
    personalRepository: PersonalRepository,
    cargoRepository: CatalogRepository,
    localidadRepository: CatalogRepository,
    roleRepository: OperationalRoleRepository,
  ) {
    this.personalRepository = personalRepository
    this.cargoRepository = cargoRepository
    this.localidadRepository = localidadRepository
    this.roleRepository = roleRepository
  }

  async execute(
    actor: User,
    rows: ParsedPersonalRow[],
    skipped: number,
    onProgress?: (done: number, total: number) => void,
  ): Promise<PersonalImportResult> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede importar personal')
    }
    if (rows.length === 0) {
      throw new ValidationError('El Excel no tiene filas de personal válidas')
    }

    const uniqueCargos = [...new Set(rows.map((row) => row.cargoName))]
    const uniqueLocalidades = [...new Set(rows.map((row) => row.localidadName))]
    const total = uniqueCargos.length + uniqueLocalidades.length + rows.length
    let done = 0
    const report = () => onProgress?.(done, total)
    report()

    const cargos = await this.ensureCatalog(
      actor,
      this.cargoRepository,
      uniqueCargos,
      () => {
        done += 1
        report()
      },
    )
    const localidades = await this.ensureCatalog(
      actor,
      this.localidadRepository,
      uniqueLocalidades,
      () => {
        done += 1
        report()
      },
    )

    let created = 0
    let updated = 0
    for (const row of rows) {
      const cargo = cargos.items.get(row.cargoName)
      const localidad = localidades.items.get(row.localidadName)
      if (!cargo || !localidad) {
        done += 1
        report()
        continue
      }

      const existing = await this.personalRepository.findByDni(row.dni)
      const role = await technicianRoleForCargo(this.roleRepository, cargo.name, {
        roleId: existing?.roleId ?? '',
        roleName: existing?.roleName ?? '',
      })
      const payload = {
        nombres: row.nombres,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
        dni: row.dni,
        cargoId: cargo.id,
        cargoName: cargo.name,
        localidadId: localidad.id,
        localidadName: localidad.name,
        condicion: row.condicion,
        roleId: role.roleId,
        roleName: role.roleName,
        createdById: actor.id,
        createdByName: actor.displayName,
      }
      if (existing) {
        await this.personalRepository.update(existing.id, {
          ...payload,
          createdById: existing.createdById,
          createdByName: existing.createdByName,
        })
        updated += 1
      } else {
        await this.personalRepository.create(payload)
        created += 1
      }
      done += 1
      report()
    }

    return {
      count: created + updated,
      created,
      updated,
      skipped,
      cargosCreated: cargos.created,
      localidadesCreated: localidades.created,
    }
  }

  private async ensureCatalog(
    actor: User,
    repository: CatalogRepository,
    names: string[],
    onItem?: () => void,
  ): Promise<{ items: Map<string, CatalogItem>; created: number }> {
    const existing = await repository.listAll()
    const byKey = new Map(
      existing.map((item) => [item.name.trim().toLowerCase(), item]),
    )
    const items = new Map<string, CatalogItem>()
    let created = 0
    for (const name of names) {
      const key = name.trim().toLowerCase()
      const found = byKey.get(key)
      if (found) {
        items.set(name, found)
        onItem?.()
        continue
      }
      const next = await repository.create({
        name,
        createdById: actor.id,
        createdByName: actor.displayName,
      })
      byKey.set(key, next)
      items.set(name, next)
      created += 1
      onItem?.()
    }
    return { items, created }
  }
}
