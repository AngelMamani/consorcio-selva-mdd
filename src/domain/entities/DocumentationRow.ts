export interface DocumentationImageValue {
  storagePath: string
  downloadUrl: string
  fileName: string
}

export type DocumentationCellValue =
  | string
  | number
  | DocumentationImageValue
  | null

export interface DocumentationRow {
  id: string
  typeId: string
  values: Record<string, DocumentationCellValue>
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}
