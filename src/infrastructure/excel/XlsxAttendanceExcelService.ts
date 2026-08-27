import * as XLSX from 'xlsx'
import type {
  AttendanceExportLine,
  AttendanceExportReport,
} from '@/domain/entities/AttendanceExportReport'
import {
  formatExportCoord,
  formatExportMeters,
} from '@/domain/entities/AttendanceExportReport'
import type {
  AttendanceExcelExportService,
  AttendanceExportFile,
} from '@/domain/repositories/AttendanceExcelExportService'

const EXCEL_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const LIST_HEADERS = [
  'N°',
  'Nombre',
  'DNI',
  'Rol',
  'Asistió',
  'Tipo',
  'Hora',
  'Motivo permiso',
  'Distancia oficina (m)',
  'Latitud',
  'Longitud',
  'Mapa GPS',
]

function lineToRow(
  line: AttendanceExportLine,
  index: number,
): (string | number)[] {
  return [
    index + 1,
    line.personName,
    line.personDni,
    line.personRole,
    line.attendedLabel,
    line.originLabel,
    line.timeLabel,
    line.permissionNote,
    formatExportMeters(line.distanceToOfficeMeters),
    formatExportCoord(line.latitude),
    formatExportCoord(line.longitude),
    line.mapUrl,
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
  setColumnWidths(sheet, [6, 32, 12, 18, 10, 14, 10, 28, 20, 14, 14, 36])
}

function addMapLinks(
  sheet: XLSX.WorkSheet,
  headerRowIndex: number,
  lines: AttendanceExportLine[],
): void {
  const mapCol = LIST_HEADERS.length - 1
  lines.forEach((line, index) => {
    if (!line.mapUrl) return
    const cellRef = XLSX.utils.encode_cell({
      r: headerRowIndex + index,
      c: mapCol,
    })
    sheet[cellRef] = {
      t: 's',
      v: 'Abrir mapa',
      l: { Target: line.mapUrl, Tooltip: 'Ver ubicación GPS' },
    }
  })
}

function createListSheet(
  title: string,
  purpose: string,
  report: AttendanceExportReport,
  lines: AttendanceExportLine[],
): XLSX.WorkSheet {
  const matrix: (string | number)[][] = [
    [title],
    [purpose],
    [`Fecha: ${report.dateLabel}`],
    LIST_HEADERS,
    ...lines.map((line, index) => lineToRow(line, index)),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyListLayout(sheet, 4, lines.length)
  addMapLinks(sheet, 4, lines)
  return sheet
}

function createSummarySheet(report: AttendanceExportReport): XLSX.WorkSheet {
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Asistencia del día'],
    [],
    ['Fecha', report.dateLabel],
    ['Generado', report.generatedAtLabel],
    ['Generado por', report.generatedByName],
    ['Oficina', report.officeName],
    ['Radio oficina (m)', report.officeRadiusMeters],
    [],
    ['Resumen'],
    ['Personas', report.totals.people],
    ['Asistieron', report.totals.present],
    ['En oficina', report.totals.office],
    ['En campo', report.totals.zone],
    ['Con permiso', report.totals.permiso],
    ['No asistieron', report.totals.missing],
    [],
    ['Hojas'],
    ['01 Resumen', 'Indicadores del día'],
    ['02 Lista', 'Todas las personas, asistió sí o no'],
    ['03 Oficina', 'Marcas con GPS en oficina'],
    ['04 Campo', 'Marcas con GPS en campo'],
    ['05 Permiso', 'Personas con permiso'],
    ['06 No asistió', 'Sin marca y sin permiso'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  setColumnWidths(sheet, [28, 56])
  return sheet
}

export class XlsxAttendanceExcelService implements AttendanceExcelExportService {
  createWorkbook(report: AttendanceExportReport): AttendanceExportFile {
    const book = XLSX.utils.book_new()
    book.Props = {
      Title: `Asistencia ${report.dateKey}`,
      Author: 'Consorcio Selva MDD',
      Subject: 'Asistencia del día',
    }

    XLSX.utils.book_append_sheet(book, createSummarySheet(report), '01 Resumen')
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Lista del día',
        'Ordenada por nombre. Asistió: Sí / No. Tipo: Oficina, Campo o Permiso.',
        report,
        report.all,
      ),
      '02 Lista',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Oficina',
        'Personas que marcaron en la oficina con GPS.',
        report,
        report.office,
      ),
      '03 Oficina',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Campo',
        'Personas que marcaron en campo con GPS.',
        report,
        report.zone,
      ),
      '04 Campo',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Permiso',
        'Personas con permiso registrado ese día.',
        report,
        report.permiso,
      ),
      '05 Permiso',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'No asistió',
        'Personas sin marca y sin permiso.',
        report,
        report.missing,
      ),
      '06 No asistió',
    )

    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: `asistencia-${report.dateKey}.xlsx`,
    }
  }
}
