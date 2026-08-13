export function sanitizePdfFileName(rawName: string): string {
  const cleaned = rawName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')

  const withoutExtension = cleaned.replace(/\.pdf$/i, '').trim()
  const baseName = withoutExtension || 'carpeta-imagenes'
  return `${baseName}.pdf`
}
