import * as XLSX from 'xlsx'
import type {
  PersonalExportLine,
  PersonalExportReport,
} from '@/domain/entities/PersonalExportReport'
import type {
  PersonalExcelExportService,
  PersonalExportFile,
} from '@/domain/repositories/PersonalExcelExportService'

const EXCEL_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const LIST_HEADERS = [
  'N°',
  'Apellidos y nombres',
  'DNI',
  'Cargo',
  'Localidad',
  'Roles',
  'Condición',
]

function lineToRow(
  line: PersonalExportLine,
  index: number,
): (string | number)[] {
  return [
    index + 1,
    line.fullName,
    line.dni,
    line.cargoName,
    line.localidadName,
    line.rolesLabel,
    line.conditionLabel,
  ]
}

function setColumnWidths(sheet: XLSX.WorkSheet, widths: number[]): void {
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
}

function freezeHeader(sheet: XLSX.WorkSheet, headerRowIndex: number): void {
  sheet['!views'] = [{ state: 'frozen', ySplit: headerRowIndex }]
}

function applyListLayout(
  sheet: XLSX.WorkSheet,
  headerRowIndex: number,
  rowCount: number,
): void {
  const lastRow = headerRowIndex + Math.max(rowCount, 1)
  const range = XLSX.utils.encode_range({
    s: { r: headerRowIndex - 1, c: 0 },
    e: { r: lastRow - 1, c: LIST_HEADERS.length - 1 },
  })
  sheet['!autofilter'] = { ref: range }
  freezeHeader(sheet, headerRowIndex)
  setColumnWidths(sheet, [6, 36, 12, 28, 24, 28, 14])
}

function createListSheet(
  title: string,
  purpose: string,
  report: PersonalExportReport,
  lines: PersonalExportLine[],
): XLSX.WorkSheet {
  const matrix: (string | number)[][] = [
    [title],
    [purpose],
    [`Filtro: ${report.filterLabel}`],
    [`Generado: ${report.generatedAtLabel} · ${report.generatedByName}`],
    LIST_HEADERS,
    ...lines.map((line, index) => lineToRow(line, index)),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyListLayout(sheet, 5, lines.length)
  return sheet
}

function createSummarySheet(report: PersonalExportReport): XLSX.WorkSheet {
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Recursos Humanos'],
    [],
    ['Generado', report.generatedAtLabel],
    ['Generado por', report.generatedByName],
    ['Filtro', report.filterLabel],
    ['Personas en el listado', report.totals.people],
    ['Total en RR.HH.', report.rosterCount],
    [],
    ['Resumen del listado'],
    ['Personas', report.totals.people],
    ['Vigentes', report.totals.vigentes],
    ['Ingreso', report.totals.ingresos],
    ['Retirados', report.totals.retirados],
    ['Sin rol', report.totals.withoutRole],
    [],
    ['Hojas'],
    ['01 Resumen', 'Indicadores del listado'],
    ['02 Lista', 'Personal exportado, orden A–Z'],
    ['03 Vigentes', 'Condición vigente'],
    ['04 Sin rol', 'Sin rol de acceso'],
    ['05 Retirados', 'Condición retirado'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  setColumnWidths(sheet, [28, 48])
  return sheet
}

export class XlsxPersonalExcelService implements PersonalExcelExportService {
  createWorkbook(report: PersonalExportReport): PersonalExportFile {
    const book = XLSX.utils.book_new()
    book.Props = {
      Title: `Personal ${report.dateKey}`,
      Author: 'Consorcio Selva MDD',
      Subject: 'Recursos Humanos',
    }

    XLSX.utils.book_append_sheet(book, createSummarySheet(report), '01 Resumen')
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Lista de personal',
        'Ordenada A–Z. Una fila por persona (DNI).',
        report,
        report.all,
      ),
      '02 Lista',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Vigentes',
        'Personas con condición vigente.',
        report,
        report.vigentes,
      ),
      '03 Vigentes',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Sin rol',
        'Personas sin rol de acceso asignado.',
        report,
        report.withoutRole,
      ),
      '04 Sin rol',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Retirados',
        'Personas con condición retirado.',
        report,
        report.retirados,
      ),
      '05 Retirados',
    )

    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: `personal-${report.dateKey}.xlsx`,
    }
  }
}
