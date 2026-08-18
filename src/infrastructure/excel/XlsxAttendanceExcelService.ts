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
  'Técnico',
  'Correo',
  'Estado',
  'Origen',
  'Hora',
  'Área',
  'Latitud',
  'Longitud',
  'Precisión (m)',
  'Distancia oficina (m)',
  'GPS oficina validado',
  'Foto entorno',
  'Mapa GPS',
]

function lineToRow(line: AttendanceExportLine): (string | number)[] {
  return [
    line.technicianName,
    line.technicianEmail,
    line.status,
    line.originLabel,
    line.timeLabel,
    line.areaName,
    formatExportCoord(line.latitude),
    formatExportCoord(line.longitude),
    formatExportMeters(line.accuracyMeters),
    formatExportMeters(line.distanceToOfficeMeters),
    line.officeValidatedLabel,
    line.photoUrl,
    line.mapUrl,
  ]
}

function setColumnWidths(
  sheet: XLSX.WorkSheet,
  widths: number[],
): void {
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
  setColumnWidths(sheet, [28, 32, 14, 16, 10, 22, 14, 14, 14, 20, 20, 40, 36])
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
    ...lines.map(lineToRow),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyListLayout(sheet, 4, lines.length)
  addMapLinks(sheet, 4, lines)
  return sheet
}

function createSummarySheet(report: AttendanceExportReport): XLSX.WorkSheet {
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Control diario de asistencia (Excel)'],
    [],
    ['Para qué sirve este archivo'],
    [
      'Planillas, filtros, seguimiento y GPS. Las fotos van en el PDF de evidencia.',
    ],
    [],
    ['Fecha', report.dateLabel],
    ['Generado', report.generatedAtLabel],
    ['Generado por', report.generatedByName],
    ['Oficina', report.officeName],
    ['Latitud oficina', report.officeLatitude],
    ['Longitud oficina', report.officeLongitude],
    ['Radio oficina (m)', report.officeRadiusMeters],
    [],
    ['Indicadores del día'],
    ['Técnicos', report.totals.technicians],
    ['Presentes', report.totals.present],
    ['En oficina', report.totals.office],
    ['En campo', report.totals.zone],
    ['Sin marcar', report.totals.missing],
    [],
    ['Hojas de este Excel'],
    ['01 Resumen', 'Indicadores y metadatos del día'],
    ['02 Lista', 'Todos los técnicos, presentes y ausentes'],
    ['03 Oficina', 'Solo marcas validadas en oficina'],
    ['04 Campo', 'Solo marcas en zona de trabajo'],
    ['05 Sin marcar', 'Pendientes de seguimiento'],
    ['06 GPS', 'Coordenadas para ubicar en mapa'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  setColumnWidths(sheet, [28, 56])
  return sheet
}

function createGpsSheet(report: AttendanceExportReport): XLSX.WorkSheet {
  const headers = [
    'Técnico',
    'Origen',
    'Hora',
    'Área',
    'Latitud',
    'Longitud',
    'Mapa GPS',
  ]
  const present = report.present
  const matrix: (string | number)[][] = [
    ['GPS del día'],
    ['Solo técnicos que marcaron. Úsala para ubicar puntos en un mapa.'],
    [`Fecha: ${report.dateLabel}`],
    headers,
    ...present.map((line) => [
      line.technicianName,
      line.originLabel,
      line.timeLabel,
      line.areaName,
      formatExportCoord(line.latitude),
      formatExportCoord(line.longitude),
      line.mapUrl,
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  const lastRow = 4 + Math.max(present.length, 1)
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 3, c: 0 },
      e: { r: lastRow - 1, c: headers.length - 1 },
    }),
  }
  freezeHeader(sheet, 4)
  setColumnWidths(sheet, [28, 16, 10, 22, 14, 14, 36])
  present.forEach((line, index) => {
    if (!line.mapUrl) return
    const cellRef = XLSX.utils.encode_cell({ r: 4 + index, c: 6 })
    sheet[cellRef] = {
      t: 's',
      v: 'Abrir mapa',
      l: { Target: line.mapUrl, Tooltip: 'Ver ubicación GPS' },
    }
  })
  return sheet
}

export class XlsxAttendanceExcelService implements AttendanceExcelExportService {
  createWorkbook(report: AttendanceExportReport): AttendanceExportFile {
    const book = XLSX.utils.book_new()
    book.Props = {
      Title: `Asistencia ${report.dateKey}`,
      Author: 'Consorcio Selva MDD',
      Subject: 'Control diario de asistencia',
    }

    XLSX.utils.book_append_sheet(book, createSummarySheet(report), '01 Resumen')
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Lista general',
        'Control de RRHH: todos los técnicos del día.',
        report,
        report.all,
      ),
      '02 Lista',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Oficina',
        'Marcas en oficina, con GPS validado dentro del radio.',
        report,
        report.office,
      ),
      '03 Oficina',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Campo',
        'Marcas en zona de trabajo, con GPS. Foto opcional.',
        report,
        report.zone,
      ),
      '04 Campo',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Sin marcar',
        'Técnicos pendientes. Sirve para seguimiento del día.',
        report,
        report.missing,
      ),
      '05 Sin marcar',
    )
    XLSX.utils.book_append_sheet(book, createGpsSheet(report), '06 GPS')

    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: `asistencia-${report.dateKey}-control.xlsx`,
    }
  }
}
