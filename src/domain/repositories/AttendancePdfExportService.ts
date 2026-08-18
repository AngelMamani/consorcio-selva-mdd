import type { AttendanceExportReport } from '@/domain/entities/AttendanceExportReport'
import type { AttendanceExportFile } from '@/domain/repositories/AttendanceExcelExportService'

export interface AttendancePdfExportService {
  createEvidenceDocument(
    report: AttendanceExportReport,
  ): Promise<AttendanceExportFile>
}
