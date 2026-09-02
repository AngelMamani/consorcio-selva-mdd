import type { StationCatalogExportReport } from '@/domain/entities/StationCatalogExportReport'

export interface StationCatalogExportFile {
  blob: Blob
  fileName: string
}

export interface StationCatalogExcelExportService {
  createWorkbook(report: StationCatalogExportReport): StationCatalogExportFile
}
