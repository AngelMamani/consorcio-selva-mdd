export const AreaAssignmentMode = {
  Routes: 'routes',
  WorkOrders: 'work_orders',
} as const

export type AreaAssignmentMode =
  (typeof AreaAssignmentMode)[keyof typeof AreaAssignmentMode]

export function isAreaAssignmentMode(value: unknown): value is AreaAssignmentMode {
  return value === AreaAssignmentMode.Routes || value === AreaAssignmentMode.WorkOrders
}

export function looksLikeInstallationActivity(name: string): boolean {
  return /instalaci[oó]n/i.test(name.trim())
}

/** Detecta actividades de cambio de medidor (LISTA_CM / CM). */
export function looksLikeMeterChangeActivity(name: string): boolean {
  const key = activityNameKey(name)
  return (
    /cambio\s+de\s+medidor/.test(key) ||
    /cambio\s+medidor/.test(key) ||
    /^cm(\s|$)/.test(key) ||
    /\bcm\b/.test(key)
  )
}

export function looksLikeWorkOrderActivity(name: string): boolean {
  return looksLikeInstallationActivity(name) || looksLikeMeterChangeActivity(name)
}

/** Deuda / notificaciones: las trabaja el admin en carpetas, no por técnico. */
export function looksLikeAdminManagedFolderActivity(name: string): boolean {
  const key = activityNameKey(name)
  return (
    /\bdeuda\b/.test(key) ||
    /notificacion/.test(key) ||
    key === 'area de notificaciones' ||
    key.startsWith('area de notificaciones')
  )
}

/** Mejoramiento de suministro: admin edita fotos locales (sello de fecha). */
export function looksLikeSupplyImprovementActivity(name: string): boolean {
  const key = activityNameKey(name)
  return (
    /mejoramiento\s+de\s+suministro/.test(key) ||
    /mejoramiento\s+suministro/.test(key) ||
    /\bmejoramiento\b/.test(key)
  )
}

export function activityNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function inferAreaAssignmentMode(
  name: string,
  explicit?: string | null,
): AreaAssignmentMode {
  if (isAreaAssignmentMode(explicit)) return explicit
  return looksLikeWorkOrderActivity(name)
    ? AreaAssignmentMode.WorkOrders
    : AreaAssignmentMode.Routes
}

export function normalizeReportCode(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  return cleaned || fallback
}

export function defaultReportCode(
  mode: AreaAssignmentMode,
  name: string,
): string {
  if (mode === AreaAssignmentMode.WorkOrders) {
    return looksLikeMeterChangeActivity(name) ? 'CM' : 'IN'
  }
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase()
  return letters || 'ACT'
}
