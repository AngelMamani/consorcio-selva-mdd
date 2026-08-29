import * as XLSX from 'xlsx'
import type { InstallationOrder } from '@/domain/entities/InstallationOrder'
import {
  formatInstallationDate,
  formatInstallationDateTime,
  installationRegisteredFlag,
} from '@/domain/entities/InstallationOrder'
import type {
  InstallationOrderExcelExportService,
  InstallationOrderExportFile,
  InstallationOrderExportReport,
} from '@/domain/repositories/InstallationOrderExportService'
import { INSTALLATION_IMPORT_HEADERS } from '@/infrastructure/excel/parseInstallationOrdersExcel'

const EXCEL_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function orderToRow(order: InstallationOrder): (string | number)[] {
  return [
    order.orderNumber,
    order.subType,
    order.applicantName,
    order.applicantAddress,
    order.sectorCijp,
    order.sector,
    order.supplyCode,
    order.neighborRouteCode,
    order.attentionCenter,
    order.registeredFlag ? installationRegisteredFlag(order.registeredFlag) : 'NO',
    order.categoryCode,
    order.referenceNumber,
    formatInstallationDateTime(order.recordedAt),
    order.typeInitials,
    order.classification,
    order.executionNotes,
    order.technicianName,
    formatInstallationDate(order.scheduledDate),
  ]
}

function sheetFromMatrix(
  matrix: (string | number)[][],
  widths: number[],
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
  sheet['!views'] = [{ state: 'frozen', ySplit: 1 }]
  return sheet
}

export class XlsxInstallationOrderExcelService
  implements InstallationOrderExcelExportService
{
  createWorkbook(
    report: InstallationOrderExportReport,
  ): InstallationOrderExportFile {
    const matrix: (string | number)[][] = [
      [...INSTALLATION_IMPORT_HEADERS],
      ...report.orders.map(orderToRow),
    ]
    const sheet = sheetFromMatrix(matrix, [
      20, 22, 28, 32, 14, 14, 14, 16, 14, 8, 10, 16, 18, 8, 8, 18, 24, 14,
    ])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Ordenes')
    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: `${report.technicianName || 'ordenes'}_${report.reportCode}.xlsx`,
    }
  }

  createImportTemplate(): InstallationOrderExportFile {
    const example: (string | number)[] = [
      '2025200002000217590',
      'INSTALACION NUEVA C1',
      'CHAMAN ARANA ROSA MARIA',
      'AV. VICTOR ESPINOZA PORRAS MZ F LOTE-3',
      'MALDONADO',
      'MALDONADO',
      '12000060091',
      '2002319004013',
      'MALDONADO',
      'SI',
      'I C.',
      '2002319004013',
      '4/9/2025 09:00:00',
      'RM',
      'F',
      '',
      'JESUS LOPEZ SOTO',
      '4/9/2025',
    ]
    const sheet = sheetFromMatrix(
      [[...INSTALLATION_IMPORT_HEADERS], example],
      [20, 22, 28, 32, 14, 14, 14, 16, 14, 8, 10, 16, 18, 8, 8, 18, 24, 14],
    )
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Ordenes')
    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: 'plantilla-instalaciones-nuevas.xlsx',
    }
  }
}
