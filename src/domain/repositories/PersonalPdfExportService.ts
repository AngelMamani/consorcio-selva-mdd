import type { PersonalExportReport } from '@/domain/entities/PersonalExportReport'
import type { PersonalExportFile } from '@/domain/repositories/PersonalExcelExportService'

export interface PersonalPdfExportService {
  createDocument(report: PersonalExportReport): PersonalExportFile
}
