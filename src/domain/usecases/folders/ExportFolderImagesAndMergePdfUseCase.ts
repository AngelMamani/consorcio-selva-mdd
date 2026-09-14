import type { User } from '@/domain/entities/User'
import type {
  PdfExportResult,
  PdfExportService,
} from '@/domain/repositories/PdfExportService'
import { ValidationError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'
import { ExportFolderImagesToPdfUseCase } from '@/domain/usecases/folders/ExportFolderImagesToPdfUseCase'
import { readPdfFileAsArrayBuffer } from '@/domain/usecases/folders/MergePdfsUseCase'

export type FolderImagesMergeOrder = 'photosFirst' | 'attachFirst'

export class ExportFolderImagesAndMergePdfUseCase {
  private readonly exportFolderImagesToPdfUseCase: ExportFolderImagesToPdfUseCase
  private readonly pdfExportService: PdfExportService

  constructor(
    exportFolderImagesToPdfUseCase: ExportFolderImagesToPdfUseCase,
    pdfExportService: PdfExportService,
  ) {
    this.exportFolderImagesToPdfUseCase = exportFolderImagesToPdfUseCase
    this.pdfExportService = pdfExportService
  }

  async execute(
    actor: User,
    folderId: string,
    requestedFileName: string,
    attachedPdf: File,
    order: FolderImagesMergeOrder,
    dateId?: string,
    uploadedById?: string,
  ): Promise<PdfExportResult> {
    if (!attachedPdf) {
      throw new ValidationError('Adjunta el segundo PDF')
    }

    const fileName = sanitizePdfFileName(requestedFileName)
    if (!fileName) {
      throw new ValidationError('El nombre del PDF es obligatorio')
    }

    const photosPdf = await this.exportFolderImagesToPdfUseCase.execute(
      actor,
      folderId,
      fileName,
      dateId,
      uploadedById,
    )
    const photosBytes = await photosPdf.blob.arrayBuffer()
    const attachedBytes = await readPdfFileAsArrayBuffer(attachedPdf)

    const documents =
      order === 'attachFirst'
        ? [attachedBytes, photosBytes]
        : [photosBytes, attachedBytes]

    return this.pdfExportService.mergeDocuments(fileName, documents)
  }
}
