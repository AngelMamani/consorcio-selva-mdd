import * as XLSX from 'xlsx'
import type { ParsedPersonalRow } from '@/domain/entities/Personal'
import { parsePersonalCondition } from '@/domain/value-objects/PersonalCondition'
import { ValidationError } from '@/domain/errors/DomainError'

export interface ParsePersonalExcelResult {
  rows: ParsedPersonalRow[]
  skipped: number
}

function headerKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function cellText(value: unknown): string {
  if (value == null || value === '') return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

function cellDni(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  return cellText(value).replace(/\D/g, '')
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function parsePersonalExcel(buffer: ArrayBuffer): ParsePersonalExcelResult {
  const book = XLSX.read(buffer, { type: 'array' })
  const sheetName = book.SheetNames[0]
  if (!sheetName) {
    throw new ValidationError('El archivo Excel está vacío')
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    book.Sheets[sheetName],
    { header: 1, defval: null, raw: true },
  )

  let headerIndex = -1
  let columns = {
    nombres: -1,
    apellidoPaterno: -1,
    apellidoMaterno: -1,
    dni: -1,
    cargo: -1,
    localidad: -1,
    condicion: -1,
  }

  for (let index = 0; index < Math.min(matrix.length, 12); index += 1) {
    const headers = (matrix[index] ?? []).map(headerKey)
    const nombres = headers.findIndex((item) => item === 'NOMBRES')
    const dni = headers.findIndex((item) => item === 'DNI')
    const cargo = headers.findIndex((item) => item === 'CARGO')
    const localidad = headers.findIndex((item) => item === 'LOCALIDAD')
    if (nombres >= 0 && dni >= 0 && cargo >= 0 && localidad >= 0) {
      headerIndex = index
      columns = {
        nombres,
        apellidoPaterno: headers.findIndex((item) => item === 'APELLIDO PATERNO'),
        apellidoMaterno: headers.findIndex((item) => item === 'APELLIDO MATERNO'),
        dni,
        cargo,
        localidad,
        condicion: headers.findIndex((item) => item === 'CONDICION'),
      }
      break
    }
  }

  if (headerIndex < 0) {
    throw new ValidationError(
      'No se encontró la fila de encabezados (NOMBRES, DNI, CARGO, LOCALIDAD)',
    )
  }

  const byDni = new Map<string, ParsedPersonalRow>()
  let skipped = 0

  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? []
    const nombres = normalizeName(cellText(row[columns.nombres]))
    const apellidoPaterno = normalizeName(
      cellText(row[columns.apellidoPaterno] ?? ''),
    )
    const apellidoMaterno = normalizeName(
      cellText(row[columns.apellidoMaterno] ?? ''),
    )
    const dni = cellDni(row[columns.dni])
    const cargoName = normalizeName(cellText(row[columns.cargo]))
    const localidadName = normalizeName(cellText(row[columns.localidad]))
    const condicion = parsePersonalCondition(
      columns.condicion >= 0 ? cellText(row[columns.condicion]) : '',
    )

    const empty = !nombres && !dni && !cargoName && !localidadName
    if (empty) continue

    if (
      !nombres ||
      !apellidoPaterno ||
      !apellidoMaterno ||
      !/^\d{8}$/.test(dni) ||
      !cargoName ||
      !localidadName
    ) {
      skipped += 1
      continue
    }

    byDni.set(dni, {
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      dni,
      cargoName,
      localidadName,
      condicion,
    })
  }

  return {
    rows: [...byDni.values()],
    skipped,
  }
}
