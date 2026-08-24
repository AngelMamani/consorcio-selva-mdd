import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  catalogNameKey,
  type CatalogItem,
} from '@/domain/entities/CatalogItem'
import type { CatalogRepository } from '@/domain/repositories/CatalogRepository'
import type { PersonalRepository } from '@/domain/repositories/PersonalRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface CatalogLabels {
  singular: string
  plural: string
}

function normalizeCatalogName(name: string, labels: CatalogLabels): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    throw new ValidationError(`El nombre del ${labels.singular} es obligatorio`)
  }
  if (trimmed.length > 80) {
    throw new ValidationError('El nombre no debe superar 80 caracteres')
  }
  return trimmed
}

export class CatalogCrudUseCases {
  private readonly catalogRepository: CatalogRepository
  private readonly labels: CatalogLabels
  private readonly personalRepository: PersonalRepository
  private readonly link: 'cargo' | 'localidad'

  constructor(
    catalogRepository: CatalogRepository,
    personalRepository: PersonalRepository,
    labels: CatalogLabels,
    link: 'cargo' | 'localidad',
  ) {
    this.catalogRepository = catalogRepository
    this.personalRepository = personalRepository
    this.labels = labels
    this.link = link
  }

  async list(actor: User): Promise<CatalogItem[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return this.catalogRepository.listAll()
  }

  async create(actor: User, name: string): Promise<CatalogItem> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        `Solo el administrador puede crear ${this.labels.plural}`,
      )
    }
    const normalized = normalizeCatalogName(name, this.labels)
    const existing = await this.catalogRepository.findByName(normalized)
    if (existing) {
      throw new ValidationError(`Ya existe un ${this.labels.singular} con ese nombre`)
    }
    return this.catalogRepository.create({
      name: normalized,
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }

  async update(actor: User, id: string, name: string): Promise<CatalogItem> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        `Solo el administrador puede editar ${this.labels.plural}`,
      )
    }
    const current = await this.catalogRepository.getById(id)
    if (!current) {
      throw new ValidationError(`${capitalize(this.labels.singular)} no encontrado`)
    }
    const normalized = normalizeCatalogName(name, this.labels)
    const duplicate = await this.catalogRepository.findByName(normalized)
    if (duplicate && duplicate.id !== id) {
      throw new ValidationError(`Ya existe un ${this.labels.singular} con ese nombre`)
    }
    const updated = await this.catalogRepository.update(id, { name: normalized })
    if (catalogNameKey(current.name) !== catalogNameKey(normalized)) {
      if (this.link === 'cargo') {
        await this.personalRepository.renameCargo(id, normalized)
      } else {
        await this.personalRepository.renameLocalidad(id, normalized)
      }
    }
    return updated
  }

  async delete(actor: User, id: string): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        `Solo el administrador puede eliminar ${this.labels.plural}`,
      )
    }
    const current = await this.catalogRepository.getById(id)
    if (!current) {
      throw new ValidationError(`${capitalize(this.labels.singular)} no encontrado`)
    }
    const used =
      this.link === 'cargo'
        ? await this.personalRepository.countByCargoId(id)
        : await this.personalRepository.countByLocalidadId(id)
    if (used > 0) {
      throw new ValidationError(
        `No se puede eliminar: hay ${used} persona${used === 1 ? '' : 's'} con este ${this.labels.singular}`,
      )
    }
    await this.catalogRepository.delete(id)
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
