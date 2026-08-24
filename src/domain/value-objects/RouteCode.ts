const ROUTE_CODE_RE = /^\d{7,12}$/

export function normalizeRouteCode(value: string): string {
  return value.replace(/\D/g, '')
}

export function isRouteCode(value: string): boolean {
  return ROUTE_CODE_RE.test(value)
}
