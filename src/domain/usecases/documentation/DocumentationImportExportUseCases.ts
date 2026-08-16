import type { User } from '@/domain/entities/User'
import type { DocumentationRow } from '@/domain/entities/DocumentationRow'
import type { DocumentationRepository } from '@/domain/repositories/DocumentationRepository'
import type { DocumentationExcelService } from '@/domain/repositories/DocumentationExcelService'
import type { DocumentationWordExportService } from '@/domain/repositories/DocumentationWordExportService'
import type {
  DocumentationCellValue,
  DocumentationImageValue,
} from '@/domain/entities/DocumentationRow'
import type {
  DocumentationImageFilePayload,
} from '@/domain/repositories/DocumentationRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { DocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'
import { normalizeDocumentationValues } from '@/domain/usecases/documentation/DocumentationRowUseCases'

export class ImportDocumentationFromExcelUseCase {
  private readonly repository: DocumentationRepository
  private readonly excelService: DocumentationExcelService

  constructor(
    repository: DocumentationRepository,
    excelService: DocumentationExcelService,
  ) {
    this.repository = repository
    this.excelService = excelService
  }

  async execute(
    actor: User,
    typeId: string,
    file: ArrayBuffer,
  ): Promise<DocumentationRow[]> {
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

    const importable = type.columns.filter(
      (column) => column.type !== DocumentationColumnType.Imagen,
    )
    if (importable.length === 0) {
      throw new ValidationError(
        'No hay columnas de texto o número para importar desde Excel',
      )
    }

    const parsed = this.excelService.parseImport(file, type.columns)
    if (parsed.rows.length === 0) {
      throw new ValidationError('El Excel no contiene filas de datos')
    }
    if (parsed.rows.length > 500) {
      throw new ValidationError('Máximo 500 filas por importación')
    }

    const created: DocumentationRow[] = []
    for (const raw of parsed.rows) {
      const values: Record<string, DocumentationCellValue> = {}
      for (const column of type.columns) {
        if (column.type === DocumentationColumnType.Imagen) {
          values[column.id] = null
          continue
        }
        values[column.id] = raw[column.id] ?? null
      }

      const row = await this.repository.createRow({
        typeId,
        values: normalizeDocumentationValues(type.columns, values),
        createdById: actor.id,
        createdByName: actor.displayName,
      })
      created.push(row)
    }

    return created
  }
}

export class DownloadDocumentationExcelTemplateUseCase {
  private readonly repository: DocumentationRepository
  private readonly excelService: DocumentationExcelService

  constructor(
    repository: DocumentationRepository,
    excelService: DocumentationExcelService,
  ) {
    this.repository = repository
    this.excelService = excelService
  }

  async execute(actor: User, typeId: string): Promise<Blob> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }

    const importable = type.columns.filter(
      (column) => column.type !== DocumentationColumnType.Imagen,
    )
    if (importable.length === 0) {
      throw new ValidationError(
        'Crea columnas de texto o número para generar la plantilla',
      )
    }

    return this.excelService.buildTemplate(importable)
  }
}

export class ExportDocumentationToWordUseCase {
  private readonly repository: DocumentationRepository
  private readonly wordExportService: DocumentationWordExportService

  constructor(
    repository: DocumentationRepository,
    wordExportService: DocumentationWordExportService,
  ) {
    this.repository = repository
    this.wordExportService = wordExportService
  }

  async execute(actor: User, typeId: string): Promise<Blob> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }
    if (type.columns.length === 0) {
      throw new ValidationError('No hay columnas para exportar')
    }

    const rows = await this.repository.listRowsByType(typeId)
    return this.wordExportService.exportTable(type.name, type.columns, rows)
  }
}

export class UploadDocumentationCellImageUseCase {
  private readonly repository: DocumentationRepository

  constructor(repository: DocumentationRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    typeId: string,
    rowId: string,
    columnId: string,
    file: DocumentationImageFilePayload,
  ): Promise<DocumentationImageValue> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const type = await this.repository.getTypeById(typeId)
    if (!type) {
      throw new ValidationError('Tipo de documentación no encontrado')
    }

    const column = type.columns.find((item) => item.id === columnId)
    if (!column || column.type !== DocumentationColumnType.Imagen) {
      throw new ValidationError('La columna no admite imágenes')
    }

    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ])
    if (!allowed.has(file.contentType)) {
      throw new ValidationError('Solo se permiten imágenes JPG, PNG, WEBP o GIF')
    }
    if (file.sizeBytes <= 0 || file.sizeBytes > 10 * 1024 * 1024) {
      throw new ValidationError('La imagen no debe superar 10 MB')
    }

    const rows = await this.repository.listRowsByType(typeId)
    const row = rows.find((item) => item.id === rowId)
    if (!row) {
      throw new ValidationError('Registro no encontrado')
    }

    const previous = row.values[columnId]
    if (previous && typeof previous === 'object' && 'storagePath' in previous) {
      await this.repository.deleteCellImage(previous.storagePath)
    }

    const uploaded = await this.repository.uploadCellImage(
      typeId,
      rowId,
      columnId,
      file,
    )

    await this.repository.updateRow(rowId, {
      ...row.values,
      [columnId]: uploaded,
    })

    return uploaded
  }
}
