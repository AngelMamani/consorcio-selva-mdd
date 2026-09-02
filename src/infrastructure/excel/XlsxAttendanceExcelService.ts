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
  'Estado',
  'Tipo',
  'Punto oficina',
  'Hora',
  'Motivo permiso',
  'Distancia (m)',
  'Validado oficina',
  'Latitud',
  'Longitud',
  'Mapa GPS',
] as const

const COLUMN_WIDTHS = [5, 30, 11, 16, 9, 14, 12, 24, 9, 26, 12, 14, 13, 13, 14]

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
    line.status,
    line.originLabel,
    line.officePointName,
    line.timeLabel,
    line.permissionNote,
    formatExportMeters(line.distanceToOfficeMeters),
    line.officeValidatedLabel,
    formatExportCoord(line.latitude),
    formatExportCoord(line.longitude),
    line.mapUrl ? 'Abrir mapa' : '',
  ]
}

function setColumnWidths(sheet: XLSX.WorkSheet, widths: number[]): void {
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
}

function applyTableLayout(
  sheet: XLSX.WorkSheet,
  headerRowIndex: number,
  rowCount: number,
  colCount: number,
): void {
  const lastRow = headerRowIndex + Math.max(rowCount, 1)
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex - 1, c: 0 },
      e: { r: lastRow - 1, c: colCount - 1 },
    }),
  }
  sheet['!views'] = [{ state: 'frozen', ySplit: headerRowIndex }]
  setColumnWidths(sheet, COLUMN_WIDTHS)
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
  const headerRowIndex = 6
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    [title],
    [purpose],
    [`Fecha: ${report.dateLabel} · Generado: ${report.generatedAtLabel}`],
    [`Puntos de oficina: ${report.officeSummary}`],
    [],
    [...LIST_HEADERS],
    ...lines.map((line, index) => lineToRow(line, index)),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyTableLayout(sheet, headerRowIndex, lines.length, LIST_HEADERS.length)
  addMapLinks(sheet, headerRowIndex, lines)
  if (!sheet['!merges']) sheet['!merges'] = []
  sheet['!merges'].push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  )
  return sheet
}

function createSummarySheet(report: AttendanceExportReport): XLSX.WorkSheet {
  const officeRows = report.officePoints.flatMap((point, index) => [
    [
      `Punto ${index + 1}`,
      `${point.name} · ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} · ${point.radiusMeters} m`,
    ],
  ])
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Asistencia del día'],
    [],
    ['Fecha', report.dateLabel],
    ['Generado', report.generatedAtLabel],
    ['Generado por', report.generatedByName],
    [],
    ['Puntos de oficina autorizados'],
    ...officeRows,
    [],
    ['Resumen del día'],
    ['Personas en nómina', report.totals.people],
    ['Asistieron', report.totals.present],
    ['En oficina', report.totals.office],
    ['En campo', report.totals.zone],
    ['Con permiso (admin)', report.totals.permiso],
    ['No asistieron', report.totals.missing],
    [],
    ['Hojas del archivo'],
    ['01 Resumen', 'Indicadores y puntos de oficina'],
    ['02 Lista', 'Todas las personas del día'],
    ['03 Oficina', 'Marcas en puntos de oficina'],
    ['04 Campo', 'Marcas en campo con GPS'],
    ['05 Permiso', 'Permisos registrados por administrador'],
    ['06 No asistió', 'Sin marca ni permiso'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  setColumnWidths(sheet, [30, 58])
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
        'Orden alfabético. Permisos solo los registra un administrador.',
        report,
        report.all,
      ),
      '02 Lista',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Oficina',
        'Marcas dentro del radio de un punto de oficina autorizado.',
        report,
        report.office,
      ),
      '03 Oficina',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Campo',
        'Marcas en campo con evidencia GPS.',
        report,
        report.zone,
      ),
      '04 Campo',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'Permiso',
        'Permisos otorgados por administrador.',
        report,
        report.permiso,
      ),
      '05 Permiso',
    )
    XLSX.utils.book_append_sheet(
      book,
      createListSheet(
        'No asistió',
        'Personas sin marca ni permiso ese día.',
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
