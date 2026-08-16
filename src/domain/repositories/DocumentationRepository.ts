import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type { DocumentationType } from '@/domain/entities/DocumentationType'
import type {
  DocumentationCellValue,
  DocumentationImageValue,
  DocumentationRow,
} from '@/domain/entities/DocumentationRow'

export interface DocumentationImageFilePayload {
  fileName: string
  contentType: string
  sizeBytes: number
  data: Blob
}

export interface DocumentationRepository {
  listTypes(): Promise<DocumentationType[]>
  getTypeById(id: string): Promise<DocumentationType | null>
  createType(input: {
    name: string
    description: string
    createdById: string
    createdByName: string
  }): Promise<DocumentationType>
  updateType(
    id: string,
    input: { name: string; description: string },
  ): Promise<DocumentationType>
  deleteType(id: string): Promise<void>
  saveColumns(
    typeId: string,
    columns: DocumentationColumn[],
  ): Promise<DocumentationType>
  listRowsByType(typeId: string): Promise<DocumentationRow[]>
  createRow(input: {
    typeId: string
    values: Record<string, DocumentationCellValue>
    createdById: string
    createdByName: string
  }): Promise<DocumentationRow>
  updateRow(
    id: string,
    values: Record<string, DocumentationCellValue>,
  ): Promise<DocumentationRow>
  deleteRow(id: string): Promise<void>
  uploadCellImage(
    typeId: string,
    rowId: string,
    columnId: string,
    file: DocumentationImageFilePayload,
  ): Promise<DocumentationImageValue>
  deleteCellImage(storagePath: string): Promise<void>
}
