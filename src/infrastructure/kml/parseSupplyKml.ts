import type { ParsedSupply } from '@/domain/entities/Supply'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'
import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'

export interface ParseSupplyKmlResult {
  supplies: ParsedSupply[]
  skipped: number
  duplicates: number
}

export function parseSupplyKml(xml: string): ParseSupplyKmlResult {
  const byCode = new Map<string, ParsedSupply>()
  let skipped = 0
  let duplicates = 0

  const pairRe =
    /<name>(\d{7,12})<\/name>[\s\S]*?<coordinates>\s*([^,<\s]+)\s*,\s*([^,<\s]+)/g

  let match: RegExpExecArray | null
  while ((match = pairRe.exec(xml))) {
    const routeCode = normalizeRouteCode(match[1] ?? '')
    const longitude = Number(match[2])
    const latitude = Number(match[3])

    if (!isRouteCode(routeCode) || !isValidGeoLocation(latitude, longitude)) {
      skipped += 1
      continue
    }

    if (byCode.has(routeCode)) {
      duplicates += 1
    }

    byCode.set(routeCode, {
      routeCode,
      latitude,
      longitude,
    })
  }

  return {
    supplies: [...byCode.values()],
    skipped,
    duplicates,
  }
}
