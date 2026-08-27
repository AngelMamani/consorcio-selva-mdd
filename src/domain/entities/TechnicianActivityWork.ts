export interface ActivityTechnicianFolder {
  technicianId: string
  technicianName: string
  workCount: number
  imageCount: number
  lastPublishedAt: Date | null
}

export interface PublishedTechnicianWork {
  technicianId: string
  technicianName: string
  folderId: string
  dateId: string
  routeCode: string
  folderName: string
  dateKey: string
  imageCount: number
  publishedAt: Date
}

export interface ActivityPublishedWorkResult {
  areaId: string
  areaName: string
  technicians: ActivityTechnicianFolder[]
  works: PublishedTechnicianWork[]
}

export function workFolderTitle(work: PublishedTechnicianWork): string {
  const route = work.routeCode || work.folderName
  return route ? `${route} · ${work.dateKey}` : work.dateKey
}
