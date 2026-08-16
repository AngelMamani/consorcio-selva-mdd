import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'

export interface DocumentationExcelImportResult {
  headers: string[]
  rows: Record<string, string | number | null>[]
}

export interface DocumentationExcelService {
  buildTemplate(columns: DocumentationColumn[]): Blob
  parseImport(
    file: ArrayBuffer,
    columns: DocumentationColumn[],
  ): DocumentationExcelImportResult
}
