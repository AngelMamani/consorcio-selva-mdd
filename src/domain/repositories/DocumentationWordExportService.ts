import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type { DocumentationRow } from '@/domain/entities/DocumentationRow'

export interface DocumentationWordExportService {
  exportTable(
    typeName: string,
    columns: DocumentationColumn[],
    rows: DocumentationRow[],
  ): Promise<Blob>
}
