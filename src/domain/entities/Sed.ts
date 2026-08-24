export interface Sed {
  id: string
  code: string
  name: string
  latitude: number
  longitude: number
  updatedAt: Date
}

export interface ParsedSed {
  code: string
  name: string
  latitude: number
  longitude: number
}
