import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'

export interface DocumentationType {
  id: string
  name: string
  description: string
  columns: DocumentationColumn[]
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}
