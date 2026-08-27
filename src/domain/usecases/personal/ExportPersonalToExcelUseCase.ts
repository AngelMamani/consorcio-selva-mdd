import { buildPersonalExportReport } from '@/domain/entities/PersonalExportReport'
import type { Personal } from '@/domain/entities/Personal'
import type { User } from '@/domain/entities/User'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import type {
  PersonalExcelExportService,
  PersonalExportFile,
} from '@/domain/repositories/PersonalExcelExportService'

export class ExportPersonalToExcelUseCase {
  private readonly excelService: PersonalExcelExportService

  constructor(excelService: PersonalExcelExportService) {
    this.excelService = excelService
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

    return this.excelService.createWorkbook(
      buildPersonalExportReport({
        people,
        rosterCount: options.rosterCount,
        filterLabel: options.filterLabel,
        generatedByName: actor.displayName,
      }),
    )
  }
}
