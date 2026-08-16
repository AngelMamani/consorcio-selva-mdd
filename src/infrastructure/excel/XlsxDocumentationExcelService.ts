import * as XLSX from 'xlsx'
import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type {
  DocumentationExcelImportResult,
  DocumentationExcelService,
} from '@/domain/repositories/DocumentationExcelService'
import { DocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'
import { ValidationError } from '@/domain/errors/DomainError'

function exampleValue(column: DocumentationColumn): string | number {
  if (column.type === DocumentationColumnType.Numero) return 10
  return `Ejemplo ${column.name}`
}

export class XlsxDocumentationExcelService
  implements DocumentationExcelService
{
  buildTemplate(columns: DocumentationColumn[]): Blob {
    const headers = columns.map((column) => column.name)
    const example = columns.map((column) => exampleValue(column))
    const sheet = XLSX.utils.aoa_to_sheet([headers, example])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Documentacion')
    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  }

  parseImport(
    file: ArrayBuffer,
    columns: DocumentationColumn[],
  ): DocumentationExcelImportResult {
    const book = XLSX.read(file, { type: 'array' })
    const sheetName = book.SheetNames[0]
    if (!sheetName) {
      throw new ValidationError('El archivo Excel está vacío')
    }

    const sheet = book.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(
      sheet,
      {
        header: 1,
        defval: null,
        raw: true,
      },
    )

    if (matrix.length < 2) {
      throw new ValidationError(
        'El Excel debe tener una fila de encabezados y al menos una fila de datos',
      )
    }

    const headerRow = (matrix[0] ?? []).map((cell) =>
      String(cell ?? '')
        .trim()
        .toLowerCase(),
    )

    const importable = columns.filter(
      (column) => column.type !== DocumentationColumnType.Imagen,
    )

    const indexByColumnId = new Map<string, number>()
    for (const column of importable) {
      const index = headerRow.findIndex(
        (header) => header === column.name.trim().toLowerCase(),
      )
      if (index < 0) {
        throw new ValidationError(
          `Falta la columna "${column.name}" en el Excel. Usa la plantilla.`,
        )
      }
      indexByColumnId.set(column.id, index)
    }

    const rows: Record<string, string | number | null>[] = []
    for (let i = 1; i < matrix.length; i += 1) {
      const line = matrix[i] ?? []
      const isEmpty = line.every(
        (cell) => cell === null || cell === undefined || String(cell).trim() === '',
      )
      if (isEmpty) continue

      const values: Record<string, string | number | null> = {}
      for (const column of importable) {
        const index = indexByColumnId.get(column.id) ?? -1
        const raw = index >= 0 ? line[index] : null
        if (raw === null || raw === undefined || String(raw).trim() === '') {
          values[column.id] = null
          continue
        }
        if (column.type === DocumentationColumnType.Numero) {
          const numberValue =
            typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
          if (Number.isNaN(numberValue)) {
            throw new ValidationError(
              `Fila ${i + 1}: "${column.name}" debe ser número`,
            )
          }
          values[column.id] = numberValue
        } else {
          values[column.id] = String(raw).trim()
        }
      }
      rows.push(values)
    }

    return {
      headers: importable.map((column) => column.name),
      rows,
    }
  }
}
