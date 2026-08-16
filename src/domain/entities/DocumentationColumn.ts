import type { DocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'

export interface DocumentationColumn {
  id: string
  name: string
  type: DocumentationColumnType
  order: number
}
