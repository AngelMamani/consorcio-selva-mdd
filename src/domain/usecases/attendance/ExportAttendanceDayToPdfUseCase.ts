import { buildAttendanceExportReport } from '@/domain/entities/AttendanceExportReport'
import type { User } from '@/domain/entities/User'
import { UnauthorizedError } from '@/domain/errors/DomainError'
import type { AttendanceExportFile } from '@/domain/repositories/AttendanceExcelExportService'
import type { AttendancePdfExportService } from '@/domain/repositories/AttendancePdfExportService'
import {
  GetAttendanceSettingsUseCase,
  ListAttendanceDayUseCase,
} from '@/domain/usecases/attendance/AttendanceUseCases'

export class ExportAttendanceDayToPdfUseCase {
  private readonly listAttendanceDayUseCase: ListAttendanceDayUseCase
  private readonly getAttendanceSettingsUseCase: GetAttendanceSettingsUseCase
  private readonly pdfService: AttendancePdfExportService

  constructor(
    listAttendanceDayUseCase: ListAttendanceDayUseCase,
    getAttendanceSettingsUseCase: GetAttendanceSettingsUseCase,
    pdfService: AttendancePdfExportService,
  ) {
    this.listAttendanceDayUseCase = listAttendanceDayUseCase
    this.getAttendanceSettingsUseCase = getAttendanceSettingsUseCase
    this.pdfService = pdfService
  }

  async execute(actor: User, dateKey: string): Promise<AttendanceExportFile> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const [rows, settings] = await Promise.all([
      this.listAttendanceDayUseCase.execute(actor, dateKey),
      this.getAttendanceSettingsUseCase.execute(actor),
    ])

    return this.pdfService.createEvidenceDocument(
      buildAttendanceExportReport({
        dateKey,
        settings,
        rows: rows.map((row) => ({
          technicianName: row.technician.displayName,
          technicianEmail: row.technician.email,
          attendance: row.attendance,
        })),
        generatedByName: actor.displayName,
      }),
    )
  }
}
