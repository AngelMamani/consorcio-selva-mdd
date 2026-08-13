import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Proxy autenticado a Firebase Storage.
 * Evita CORS cuando la web corre en Vercel.
 *
 * GET /api/storage?path=folders%2F...%2Ffile.jpg
 * Header: Authorization: Bearer <Firebase ID token>
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  const storagePath = String(req.query.path ?? '').trim()
  const authorization = req.headers.authorization

  if (!storagePath || storagePath.includes('..')) {
    res.status(400).json({ error: 'Ruta de Storage inválida' })
    return
  }

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Falta token de autenticación' })
    return
  }

  const bucket =
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    'consorcio-selva-mdd.firebasestorage.app'

  const objectPath = encodeURIComponent(storagePath)
  const upstream = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectPath}?alt=media`

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        Authorization: authorization,
      },
    })

    if (!upstreamResponse.ok) {
      res
        .status(upstreamResponse.status)
        .json({ error: `Storage respondió ${upstreamResponse.status}` })
      return
    }

    const contentType =
      upstreamResponse.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await upstreamResponse.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.status(200).send(buffer)
  } catch {
    res.status(502).json({ error: 'No se pudo leer Storage' })
  }
}
