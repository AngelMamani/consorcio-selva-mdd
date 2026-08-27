import {
  personalFullName,
  personalRoleIds,
  type Personal,
} from '@/domain/entities/Personal'
import { personalConditionLabel } from '@/domain/value-objects/PersonalCondition'

export interface PersonalExportLine {
  fullName: string
  dni: string
  cargoName: string
  localidadName: string
  rolesLabel: string
  conditionLabel: string
  conditionCode: string
  hasRole: boolean
}

export interface PersonalExportReport {
  generatedAtLabel: string
  generatedByName: string
  dateKey: string
  filterLabel: string
  rosterCount: number
  totals: {
    people: number
    vigentes: number
    ingresos: number
    retirados: number
    withoutRole: number
  }
  all: PersonalExportLine[]
  vigentes: PersonalExportLine[]
  ingresos: PersonalExportLine[]
  retirados: PersonalExportLine[]
  withoutRole: PersonalExportLine[]
}

function dash(value: string): string {
  const trimmed = value.trim()
  return trimmed || '—'
}

function rolesLabel(person: Personal): string {
  const names = (person.roleNames ?? []).map((item) => item.trim()).filter(Boolean)
  if (names.length > 0) return names.join(', ')
  if (person.roleName.trim()) return person.roleName.trim()
  return 'Sin asignar'
}

function toLine(person: Personal): PersonalExportLine {
  return {
    fullName: dash(personalFullName(person)),
    dni: dash(person.dni),
    cargoName: dash(person.cargoName),
    localidadName: dash(person.localidadName),
    rolesLabel: rolesLabel(person),
    conditionLabel: personalConditionLabel(person.condicion),
    conditionCode: person.condicion || '',
    hasRole: personalRoleIds(person).length > 0,
  }
}

export function buildPersonalExportReport(input: {
  people: Personal[]
  rosterCount: number
  filterLabel: string
  generatedByName: string
}): PersonalExportReport {
  const all = input.people.map(toLine)
  const vigentes = all.filter((line) => line.conditionCode === 'VIGENTE')
  const ingresos = all.filter((line) => line.conditionCode === 'INGRESO')
  const retirados = all.filter((line) => line.conditionCode === 'RETIRADO')
  const withoutRole = all.filter((line) => !line.hasRole)

  return {
    generatedAtLabel: new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    }),
    generatedByName: input.generatedByName.trim() || '—',
    dateKey: new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
    }),
    filterLabel: input.filterLabel.trim() || 'Todo el personal',
    rosterCount: input.rosterCount,
    totals: {
      people: all.length,
      vigentes: vigentes.length,
      ingresos: ingresos.length,
      retirados: retirados.length,
      withoutRole: withoutRole.length,
    },
    all,
    vigentes,
    ingresos,
    retirados,
    withoutRole,
  }
}
