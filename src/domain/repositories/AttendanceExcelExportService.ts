import type { AttendanceExportReport } from '@/domain/entities/AttendanceExportReport'

export interface AttendanceExportFile {
  blob: Blob
  fileName: string
}

export interface AttendanceExcelExportService {
  createWorkbook(report: AttendanceExportReport): AttendanceExportFile
}
