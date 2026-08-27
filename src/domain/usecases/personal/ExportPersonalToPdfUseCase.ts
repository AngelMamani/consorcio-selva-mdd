import { buildPersonalExportReport } from '@/domain/entities/PersonalExportReport'
import type { Personal } from '@/domain/entities/Personal'
import type { User } from '@/domain/entities/User'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import type { PersonalExportFile } from '@/domain/repositories/PersonalExcelExportService'
import type { PersonalPdfExportService } from '@/domain/repositories/PersonalPdfExportService'

export class ExportPersonalToPdfUseCase {
  private readonly pdfService: PersonalPdfExportService

  constructor(pdfService: PersonalPdfExportService) {
    this.pdfService = pdfService
  }

  execute(
    actor: User,
    people: Personal[],
    options: { filterLabel: string; rosterCount: number },
  ): PersonalExportFile {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (people.length === 0) {
      throw new ValidationError('No hay personal para exportar')
    }

    return this.pdfService.createDocument(
      buildPersonalExportReport({
        people,
        rosterCount: options.rosterCount,
        filterLabel: options.filterLabel,
        generatedByName: actor.displayName,
      }),
    )
  }
}
