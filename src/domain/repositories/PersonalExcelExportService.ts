import type { PersonalExportReport } from '@/domain/entities/PersonalExportReport'

export interface PersonalExportFile {
  blob: Blob
  fileName: string
}

export interface PersonalExcelExportService {
  createWorkbook(report: PersonalExportReport): PersonalExportFile
}
