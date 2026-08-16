import type { User } from '@/domain/entities/User'
import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type { DocumentationType } from '@/domain/entities/DocumentationType'
import type { DocumentationRepository } from '@/domain/repositories/DocumentationRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { isDocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'

export class SaveDocumentationColumnsUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    typeId: string,
    columns: DocumentationColumn[],
  ): Promise<DocumentationType> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }

    if (columns.length > 40) {
      throw new ValidationError('Máximo 40 columnas')
    }

    const names = new Set<string>()
    const normalized = columns.map((column, index) => {
      const name = column.name.trim()
      if (!name) {
        throw new ValidationError('El nombre de la columna es obligatorio')
      }
      if (name.length > 80) {
        throw new ValidationError(
          'El nombre de columna no debe superar 80 caracteres',
        )
      }
      if (!isDocumentationColumnType(column.type)) {
        throw new ValidationError('Tipo de columna inválido')
      }
      const key = name.toLowerCase()
      if (names.has(key)) {
        throw new ValidationError(`Columna duplicada: ${name}`)
      }
      names.add(key)

      return {
        id: column.id.trim() || crypto.randomUUID(),
        name,
        type: column.type,
        order: index,
      }
    })

    return this.repository.saveColumns(typeId, normalized)
  }
}
