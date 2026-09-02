import * as XLSX from 'xlsx'
import type {
  SedExportLine,
  StationCatalogExportReport,
  SupplyExportLine,
} from '@/domain/entities/StationCatalogExportReport'
import type {
  StationCatalogExcelExportService,
  StationCatalogExportFile,
} from '@/domain/repositories/StationCatalogExcelExportService'

const EXCEL_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const SUPPLY_HEADERS = [
  'N°',
  'Código suministro',
  'Prefijo',
  'Latitud',
  'Longitud',
  'Nota',
  'Actualizado',
] as const

const SED_HEADERS = [
  'N°',
  'Código SED',
  'Nombre',
  'Latitud',
  'Longitud',
  'Actualizado',
] as const

function setColumnWidths(sheet: XLSX.WorkSheet, widths: number[]): void {
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
}

function applyTableLayout(
  sheet: XLSX.WorkSheet,
  headerRowIndex: number,
  rowCount: number,
  colCount: number,
  widths: number[],
): void {
  const lastRow = headerRowIndex + Math.max(rowCount, 1)
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex - 1, c: 0 },
      e: { r: lastRow - 1, c: colCount - 1 },
    }),
  }
  sheet['!views'] = [{ state: 'frozen', ySplit: headerRowIndex }]
  setColumnWidths(sheet, widths)
}

function createSummarySheet(report: StationCatalogExportReport): XLSX.WorkSheet {
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Catálogo de estaciones'],
    [],
    ['Generado', report.generatedAtLabel],
    ['Generado por', report.generatedByName],
    [],
    ['Totales en Firebase'],
    ['Suministros', report.totalSupplies],
    ['SEDs', report.totalSeds],
    [],
    ['Exportación parcial'],
    [
      'Límite por hoja',
      `Primeros ${report.exportLimit} registros ordenados por código`,
    ],
    ['Suministros exportados', report.suppliesExported],
    ['SEDs exportadas', report.sedsExported],
    [],
    ['Nota'],
    [
      'El catálogo completo puede superar decenas de miles de registros. Este Excel trae una muestra ordenada para revisión rápida.',
    ],
    [],
    ['Hojas del archivo'],
    ['01 Resumen', 'Indicadores y alcance de la exportación'],
    ['02 Suministros', 'Primeros suministros por código'],
    ['03 SEDs', 'Primeras SEDs por código'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  setColumnWidths(sheet, [28, 58])
  return sheet
}

function createSupplySheet(report: StationCatalogExportReport): XLSX.WorkSheet {
  const headerRowIndex = 5
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Suministros'],
    [
      `Primeros ${report.suppliesExported} de ${report.totalSupplies.toLocaleString('es-PE')} · Generado ${report.generatedAtLabel}`,
    ],
    [],
    [...SUPPLY_HEADERS],
    ...report.supplies.map((line, index) => supplyToRow(line, index)),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyTableLayout(
    sheet,
    headerRowIndex,
    report.supplies.length,
    SUPPLY_HEADERS.length,
    [5, 16, 10, 13, 13, 24, 18],
  )
  return sheet
}

function createSedSheet(report: StationCatalogExportReport): XLSX.WorkSheet {
  const headerRowIndex = 5
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['SEDs'],
    [
      `Primeras ${report.sedsExported} de ${report.totalSeds.toLocaleString('es-PE')} · Generado ${report.generatedAtLabel}`,
    ],
    [],
    [...SED_HEADERS],
    ...report.seds.map((line, index) => sedToRow(line, index)),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyTableLayout(
    sheet,
    headerRowIndex,
    report.seds.length,
    SED_HEADERS.length,
    [5, 12, 34, 13, 13, 18],
  )
  return sheet
}

function supplyToRow(
  line: SupplyExportLine,
  index: number,
): (string | number)[] {
  return [
    index + 1,
    line.routeCode,
    line.prefix,
    line.latitude,
    line.longitude,
    line.note,
    line.updatedAtLabel,
  ]
}

function sedToRow(line: SedExportLine, index: number): (string | number)[] {
  return [
    index + 1,
    line.code,
    line.name,
    line.latitude.toFixed(6),
    line.longitude.toFixed(6),
    line.updatedAtLabel,
  ]
}

export class XlsxStationCatalogExcelService
  implements StationCatalogExcelExportService
{
  createWorkbook(report: StationCatalogExportReport): StationCatalogExportFile {
    const book = XLSX.utils.book_new()
    book.Props = {
      Title: 'Catálogo estaciones',
      Author: 'Consorcio Selva MDD',
      Subject: 'Suministros y SEDs',
    }

    XLSX.utils.book_append_sheet(book, createSummarySheet(report), '01 Resumen')
    XLSX.utils.book_append_sheet(
      book,
      createSupplySheet(report),
      '02 Suministros',
    )
    XLSX.utils.book_append_sheet(book, createSedSheet(report), '03 SEDs')

    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    const stamp = new Date().toISOString().slice(0, 10)
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: `estaciones-${stamp}.xlsx`,
    }
  }
}
