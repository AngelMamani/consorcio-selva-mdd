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
  return looksLikeInstallationActivity(name)
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
  if (mode === AreaAssignmentMode.WorkOrders) return 'IN'
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase()
  return letters || 'ACT'
}
