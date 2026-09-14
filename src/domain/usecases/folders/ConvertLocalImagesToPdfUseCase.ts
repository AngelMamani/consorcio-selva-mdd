import type {
  PdfExportResult,
  PdfExportService,
  PdfLocalImageSource,
} from '@/domain/repositories/PdfExportService'
import { ValidationError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'
import {
  MergePdfsUseCase,
  readPdfFileAsArrayBuffer,
} from '@/domain/usecases/folders/MergePdfsUseCase'

export type LocalImagesMergeOrder = 'photosFirst' | 'attachFirst'

export class ConvertLocalImagesToPdfUseCase {
  private readonly pdfExportService: PdfExportService

  constructor(pdfExportService: PdfExportService) {
    this.pdfExportService = pdfExportService
  }

  async execute(
    requestedFileName: string,
    images: PdfLocalImageSource[],
  ): Promise<PdfExportResult> {
    const fileName = sanitizePdfFileName(requestedFileName)
    if (!fileName) {
      throw new ValidationError('El nombre del PDF es obligatorio')
    }
    if (images.length === 0) {
      throw new ValidationError('Selecciona al menos una imagen')
    }
    return this.pdfExportService.createLocalImagesDocument(fileName, images)
  }
}

export class ConvertLocalImagesAndMergePdfUseCase {
  private readonly convertLocalImagesToPdfUseCase: ConvertLocalImagesToPdfUseCase
  private readonly pdfExportService: PdfExportService

  constructor(
    convertLocalImagesToPdfUseCase: ConvertLocalImagesToPdfUseCase,
    pdfExportService: PdfExportService,
  ) {
    this.convertLocalImagesToPdfUseCase = convertLocalImagesToPdfUseCase
    this.pdfExportService = pdfExportService
  }

  async execute(
    requestedFileName: string,
    images: PdfLocalImageSource[],
    attachedPdf: File,
    order: LocalImagesMergeOrder,
  ): Promise<PdfExportResult> {
    if (!attachedPdf) {
      throw new ValidationError('Adjunta el segundo PDF')
    }
    const photosPdf = await this.convertLocalImagesToPdfUseCase.execute(
      requestedFileName,
      images,
    )
    const photosBytes = await photosPdf.blob.arrayBuffer()
    const attachedBytes = await readPdfFileAsArrayBuffer(attachedPdf)
    const documents =
      order === 'attachFirst'
        ? [attachedBytes, photosBytes]
        : [photosBytes, attachedBytes]
    return this.pdfExportService.mergeDocuments(
      sanitizePdfFileName(requestedFileName),
      documents,
    )
  }
}

export { MergePdfsUseCase }
