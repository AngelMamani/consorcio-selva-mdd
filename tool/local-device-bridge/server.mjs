/**
 * Bridge local Consorcio Selva MDD
 * Igual que la app "Escáner" de Windows: WIA + alimentador.
 */
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.DEVICE_BRIDGE_PORT || 5000)
const DEFAULT_PRINTER_IP = process.env.PRINTER_IP || '192.168.0.121'
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100)
const DEFAULT_DEVICE =
  process.env.SCAN_DEVICE ||
  process.env.TWAIN_DRIVER ||
  'Color Network ScanGear 2'
/** Como Windows Escáner: wia + feeder */
const DEFAULT_DRIVER = process.env.SCAN_DRIVER || 'wia'
const DEFAULT_SOURCE = process.env.SCAN_SOURCE || 'feeder'
const INBOX_DIR =
  process.env.SCAN_INBOX_DIR || path.join(__dirname, 'inbox')
const OUTBOX_DIR =
  process.env.SCAN_OUTBOX_DIR || path.join(__dirname, 'outbox')

function resolveNaps2Path() {
  if (process.env.NAPS2_PATH) return process.env.NAPS2_PATH
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'NAPS2', 'NAPS2.Console.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'NAPS2', 'NAPS2.Console.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'NAPS2', 'NAPS2.Console.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'NAPS2', 'NAPS2.Console.exe'),
  ]
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  try {
    const found = execSync('where NAPS2.Console.exe', {
      encoding: 'utf8',
      windowsHide: true,
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /naps2\.console\.exe$/i.test(line))
    if (found) return found
  } catch {
    // ignore
  }
  return ''
}

const NAPS2_PATH = resolveNaps2Path()

function naps2Available() {
  if (!NAPS2_PATH) return false
  if (fs.existsSync(NAPS2_PATH)) return true
  try {
    execSync('where NAPS2.Console.exe', { encoding: 'utf8', windowsHide: true })
    return true
  } catch {
    return false
  }
}

function naps2Cmd() {
  return fs.existsSync(NAPS2_PATH) ? NAPS2_PATH : 'NAPS2.Console.exe'
}

function ensureDirs() {
  for (const dir of [INBOX_DIR, OUTBOX_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function mimeFromName(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'image/jpeg'
}

function listNewestInboxFiles(limit = 20) {
  if (!fs.existsSync(INBOX_DIR)) return []
  return fs
    .readdirSync(INBOX_DIR)
    .filter((name) => /\.(jpe?g|png|webp|pdf)$/i.test(name))
    .map((name) => {
      const full = path.join(INBOX_DIR, name)
      const stat = fs.statSync(full)
      return { name, full, mtime: stat.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
}

function filesToPayload(files) {
  return files.map((item) => ({
    fileName: item.name,
    mimeType: mimeFromName(item.name),
    base64: fs.readFileSync(item.full).toString('base64'),
  }))
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

/**
 * Un solo pase como Windows Escáner:
 * WIA + alimentador → PDF multipágina con todas las hojas del ADF.
 */
async function runNaps2FeederScan(options) {
  if (!naps2Available()) {
    throw new Error('NAPS2 no disponible')
  }

  const device = options.device || DEFAULT_DEVICE
  const driver = options.driver || DEFAULT_DRIVER
  const source = options.source || DEFAULT_SOURCE
  const stamp = Date.now()
  const outFile = path.join(OUTBOX_DIR, `scan-${stamp}.pdf`)

  const args = [
    '-o',
    outFile,
    '--force',
    '--driver',
    driver,
    '--device',
    device,
    '--source',
    source,
  ]

  const result = await runProcess(naps2Cmd(), args)
  if (result.code !== 0 || !fs.existsSync(outFile)) {
    // Reintento: WIA sin source (algunos drivers lo ignoran) o TWAIN+feeder
    const fallbacks = [
      ['wia', source],
      ['wia', 'glass'],
      ['twain', source],
      ['twain', 'glass'],
    ]
    let lastError =
      result.stderr.trim() ||
      result.stdout.trim() ||
      `NAPS2 falló (código ${result.code})`

    for (const [fbDriver, fbSource] of fallbacks) {
      if (fbDriver === driver && fbSource === source) continue
      const fbOut = path.join(OUTBOX_DIR, `scan-${stamp}-${fbDriver}-${fbSource}.pdf`)
      const fbArgs = [
        '-o',
        fbOut,
        '--force',
        '--driver',
        fbDriver,
        '--device',
        device,
        '--source',
        fbSource,
      ]
      const fb = await runProcess(naps2Cmd(), fbArgs)
      if (fb.code === 0 && fs.existsSync(fbOut)) {
        return [{ name: path.basename(fbOut), full: fbOut }]
      }
      lastError =
        fb.stderr.trim() || fb.stdout.trim() || lastError
    }

    throw new Error(
      `${lastError}. En Windows Escáner funciona con “${device}” + Alimentador. Pon hojas en el ADF e inténtalo otra vez.`,
    )
  }

  return [{ name: path.basename(outFile), full: outFile }]
}

async function handleScan(body) {
  const device =
    body.twainDriverName || body.device || DEFAULT_DEVICE
  const driver = body.driver || DEFAULT_DRIVER
  const source = body.source || DEFAULT_SOURCE
  const pageCount = body.pageCount || 1

  if (naps2Available()) {
    const files = await runNaps2FeederScan({ device, driver, source })
    return {
      mode: `naps2-${driver}-${source}`,
      device,
      driver,
      source,
      pageCountRequested: pageCount,
      files: filesToPayload(files),
    }
  }

  const inbox = listNewestInboxFiles(Math.max(1, Number(pageCount) || 1))
  if (inbox.length > 0) {
    return {
      mode: 'inbox-folder',
      device,
      inboxDir: INBOX_DIR,
      files: filesToPayload(inbox),
    }
  }

  throw new Error(
    `Sin páginas. Pon hojas en el alimentador (como en Windows Escáner) o deja JPG/PDF en ${INBOX_DIR}.`,
  )
}

function printRaw(printerIp, printerPort, buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: printerIp, port: printerPort }, () => {
      socket.write(buffer, (error) => {
        if (error) {
          reject(error)
          return
        }
        socket.end()
      })
    })
    socket.setTimeout(20_000)
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Timeout al imprimir (puerto 9100)'))
    })
    socket.on('error', reject)
    socket.on('close', () => resolve())
  })
}

async function handlePrint(body) {
  const printerIp = body.printerIp || DEFAULT_PRINTER_IP
  const printerPort = Number(body.printerPort || DEFAULT_PRINTER_PORT)
  if (!body.base64) throw new Error('Falta base64 del archivo a imprimir')
  const buffer = Buffer.from(body.base64, 'base64')
  await printRaw(printerIp, printerPort, buffer)
  return {
    ok: true,
    printerIp,
    printerPort,
    bytes: buffer.length,
    fileName: body.fileName || 'documento.pdf',
  }
}

ensureDirs()

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        printerIp: DEFAULT_PRINTER_IP,
        printerPort: DEFAULT_PRINTER_PORT,
        twainDriverName: DEFAULT_DEVICE,
        device: DEFAULT_DEVICE,
        driver: DEFAULT_DRIVER,
        source: DEFAULT_SOURCE,
        scanMode: naps2Available()
          ? `naps2-${DEFAULT_DRIVER}-${DEFAULT_SOURCE}`
          : 'inbox-folder',
        inboxDir: INBOX_DIR,
        naps2: NAPS2_PATH || null,
        message: 'Bridge Consorcio listo (modo Windows Escáner: WIA + alimentador)',
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/devices') {
      if (!naps2Available()) {
        sendJson(res, 200, { wia: [], twain: [] })
        return
      }
      const wia = await runProcess(naps2Cmd(), ['--listdevices', '--driver', 'wia'])
      const twain = await runProcess(naps2Cmd(), [
        '--listdevices',
        '--driver',
        'twain',
      ])
      sendJson(res, 200, {
        wia: wia.stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean),
        twain: twain.stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean),
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/scan') {
      const body = await readBody(req)
      const result = await handleScan(body)
      sendJson(res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/print') {
      const body = await readBody(req)
      const result = await handlePrint(body)
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 404, { error: 'Ruta no encontrada' })
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Error en el bridge',
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[device-bridge] http://127.0.0.1:${PORT}`)
  console.log(`[device-bridge] Impresora ${DEFAULT_PRINTER_IP}:${DEFAULT_PRINTER_PORT}`)
  console.log(
    `[device-bridge] Escaneo como Windows: ${DEFAULT_DRIVER} + ${DEFAULT_SOURCE} · “${DEFAULT_DEVICE}”`,
  )
  console.log(`[device-bridge] Inbox: ${INBOX_DIR}`)
  if (NAPS2_PATH) {
    console.log(
      `[device-bridge] NAPS2: ${NAPS2_PATH} (disponible=${naps2Available()})`,
    )
  }
})
