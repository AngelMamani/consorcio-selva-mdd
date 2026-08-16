import type { User } from '@/domain/entities/User'
import type { DocumentationType } from '@/domain/entities/DocumentationType'
import type { DocumentationRepository } from '@/domain/repositories/DocumentationRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new ValidationError('El nombre del tipo es obligatorio')
  }
  if (trimmed.length > 120) {
    throw new ValidationError('El nombre no debe superar 120 caracteres')
  }
  return trimmed
}

function normalizeDescription(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length > 500) {
    throw new ValidationError('La descripción no debe superar 500 caracteres')
  }
  return trimmed
}

export class ListDocumentationTypesUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(actor: User): Promise<DocumentationType[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return this.repository.listTypes()
  }
}

export class GetDocumentationTypeUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(actor: User, typeId: string): Promise<DocumentationType> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }
    return type
  }
}

export class CreateDocumentationTypeUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    input: { name: string; description: string },
  ): Promise<DocumentationType> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    return this.repository.createType({
      name: normalizeName(input.name),
      description: normalizeDescription(input.description),
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class UpdateDocumentationTypeUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    typeId: string,
    input: { name: string; description: string },
  ): Promise<DocumentationType> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const existing = await this.repository.getTypeById(typeId)
    if (!existing) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }

    return this.repository.updateType(typeId, {
      name: normalizeName(input.name),
      description: normalizeDescription(input.description),
    })
  }
}

export class DeleteDocumentationTypeUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(actor: User, typeId: string): Promise<void> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const existing = await this.repository.getTypeById(typeId)
    if (!existing) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }

    const rows = await this.repository.listRowsByType(typeId)
    for (const row of rows) {
      for (const value of Object.values(row.values)) {
        if (value && typeof value === 'object' && 'storagePath' in value) {
          await this.repository.deleteCellImage(value.storagePath)
        }
      }
      await this.repository.deleteRow(row.id)
    }

    await this.repository.deleteType(typeId)
  }
}
