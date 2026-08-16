import type { User } from '@/domain/entities/User'
import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type {
  DocumentationCellValue,
  DocumentationRow,
} from '@/domain/entities/DocumentationRow'
import type { DocumentationRepository } from '@/domain/repositories/DocumentationRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { DocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'

export function normalizeDocumentationValues(
  columns: DocumentationColumn[],
  values: Record<string, DocumentationCellValue>,
): Record<string, DocumentationCellValue> {
  const next: Record<string, DocumentationCellValue> = {}

  for (const column of columns) {
    const raw = values[column.id]

    if (column.type === DocumentationColumnType.Numero) {
      if (raw === null || raw === undefined || raw === '') {
        next[column.id] = null
        continue
      }
      const numberValue =
        typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
      if (Number.isNaN(numberValue)) {
        throw new ValidationError(
          `La columna "${column.name}" debe ser un número`,
        )
      }
      next[column.id] = numberValue
      continue
    }

    if (column.type === DocumentationColumnType.Imagen) {
      if (
        raw &&
        typeof raw === 'object' &&
        'storagePath' in raw &&
        'downloadUrl' in raw
      ) {
        next[column.id] = raw
      } else {
        next[column.id] = null
      }
      continue
    }

    const text = raw === null || raw === undefined ? '' : String(raw).trim()
    if (text.length > 2000) {
      throw new ValidationError(
        `La columna "${column.name}" no debe superar 2000 caracteres`,
      )
    }
    next[column.id] = text
  }

  return next
}

export class ListDocumentationRowsUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(actor: User, typeId: string): Promise<DocumentationRow[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return this.repository.listRowsByType(typeId)
  }
}

export class CreateDocumentationRowUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    typeId: string,
    values: Record<string, DocumentationCellValue>,
  ): Promise<DocumentationRow> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }
    if (type.columns.length === 0) {
      throw new ValidationError('Primero define al menos una columna')
    }

    return this.repository.createRow({
      typeId,
      values: normalizeDocumentationValues(type.columns, values),
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class UpdateDocumentationRowUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    typeId: string,
    rowId: string,
    values: Record<string, DocumentationCellValue>,
  ): Promise<DocumentationRow> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }

    return this.repository.updateRow(
      rowId,
      normalizeDocumentationValues(type.columns, values),
    )
  }
}

export class DeleteDocumentationRowUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(actor: User, typeId: string, rowId: string): Promise<void> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const rows = await this.repository.listRowsByType(typeId)
    const row = rows.find((item) => item.id === rowId)
    if (!row) {
      throw new ValidationError('Registro no encontrado')
    }

    for (const value of Object.values(row.values)) {
      if (value && typeof value === 'object' && 'storagePath' in value) {
        await this.repository.deleteCellImage(value.storagePath)
      }
    }

    await this.repository.deleteRow(rowId)
  }
}
