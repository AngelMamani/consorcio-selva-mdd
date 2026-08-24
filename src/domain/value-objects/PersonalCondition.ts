export const PERSONAL_CONDITIONS = ['VIGENTE', 'RETIRADO', 'INGRESO'] as const

export type PersonalCondition = (typeof PERSONAL_CONDITIONS)[number]

export function isPersonalCondition(value: string): value is PersonalCondition {
  return (PERSONAL_CONDITIONS as readonly string[]).includes(value)
}

export function parsePersonalCondition(value: string): PersonalCondition | '' {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (!normalized) return ''
  if (normalized === 'VIGENTE') return 'VIGENTE'
  if (normalized === 'RETIRADO') return 'RETIRADO'
  if (normalized === 'INGRESO') return 'INGRESO'
  return ''
}

export function personalConditionLabel(value: string): string {
  if (value === 'VIGENTE') return 'Vigente'
  if (value === 'RETIRADO') return 'Retirado'
  if (value === 'INGRESO') return 'Ingreso'
  return 'Sin dato'
}
