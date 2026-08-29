import type { InstallationOrder } from '@/domain/entities/InstallationOrder'

export interface InstallationOrderExportFile {
  blob: Blob
  fileName: string
}

export interface InstallationOrderExportReport {
  areaName: string
  reportCode: string
  technicianName: string
  date: Date
  generatedByName: string
  orders: InstallationOrder[]
}

export interface InstallationOrderPdfExportService {
  createDocument(
    report: InstallationOrderExportReport,
  ): InstallationOrderExportFile
}

export interface InstallationOrderExcelExportService {
  createWorkbook(
    report: InstallationOrderExportReport,
  ): InstallationOrderExportFile
  createImportTemplate(): InstallationOrderExportFile
}
