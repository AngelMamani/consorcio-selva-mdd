/** Dominio interno: Auth exige email, el técnico entra con su DNI. */
export const TECHNICIAN_EMAIL_DOMAIN =
  'tecnicos.consorcio-selva-mdd.firebaseapp.com'

export function technicianEmailFromDni(dni: string): string {
  return `${dni}@${TECHNICIAN_EMAIL_DOMAIN}`
}

export function isTechnicianSyntheticEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${TECHNICIAN_EMAIL_DOMAIN}`)
}

export function normalizeCargoName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

/** Cargos de campo que reciben cuenta de técnico automáticamente. */
export function isElectricistaTechnicianCargo(cargoName: string): boolean {
  const normalized = normalizeCargoName(cargoName)
  return /^(TECNICO\s+)?ELECTRICISTA\s*[12]$/.test(normalized)
}
