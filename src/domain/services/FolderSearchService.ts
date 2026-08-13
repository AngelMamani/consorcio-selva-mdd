import type { ImageFolder } from '@/domain/entities/ImageFolder'

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function folderMatchesSearch(
  folder: ImageFolder,
  searchTerm: string,
): boolean {
  const term = normalizeSearchText(searchTerm)
  if (!term) return true

  const haystack = normalizeSearchText(
    `${folder.name} ${folder.description} ${folder.ownerName}`,
  )

  return term.split(/\s+/).every((token) => haystack.includes(token))
}

export type FolderSortOption = 'newest' | 'oldest' | 'name' | 'images'

export function sortFolders(
  folders: ImageFolder[],
  sortBy: FolderSortOption,
): ImageFolder[] {
  const copy = [...folders]

  switch (sortBy) {
    case 'oldest':
      return copy.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    case 'name':
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
      )
    case 'images':
      return copy.sort((a, b) => b.imageCount - a.imageCount)
    case 'newest':
    default:
      return copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
