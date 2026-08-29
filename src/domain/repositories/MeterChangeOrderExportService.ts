import type { MeterChangeOrder } from '@/domain/entities/MeterChangeOrder'

export interface MeterChangeOrderExportFile {
  blob: Blob
  fileName: string
}

export interface MeterChangeOrderExportReport {
  areaName: string
  reportCode: string
  technicianName: string
  date: Date
  generatedByName?: string
  orders: MeterChangeOrder[]
}

export interface MeterChangeOrderPdfExportService {
  createDocument(
    report: MeterChangeOrderExportReport,
  ): MeterChangeOrderExportFile
}

export interface MeterChangeOrderExcelExportService {
  createWorkbook(
    report: MeterChangeOrderExportReport,
  ): MeterChangeOrderExportFile
  createImportTemplate(): MeterChangeOrderExportFile
}
