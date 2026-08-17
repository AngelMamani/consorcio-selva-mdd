import type { FolderDate } from '@/domain/entities/FolderDate'

export interface CreateFolderDateInput {
  folderId: string
  dateKey: string
  note: string
  createdById: string
  createdByName: string
}

export interface FolderDateRepository {
  getById(id: string): Promise<FolderDate | null>
  listByFolder(folderId: string): Promise<FolderDate[]>
  findByFolderAndDateKey(
    folderId: string,
    dateKey: string,
  ): Promise<FolderDate | null>
  create(input: CreateFolderDateInput): Promise<FolderDate>
  incrementImageCount(dateId: string, delta: number): Promise<void>
  delete(id: string): Promise<void>
  deleteAllByFolder(folderId: string): Promise<void>
}
