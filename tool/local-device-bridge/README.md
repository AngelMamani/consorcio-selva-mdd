# Bridge local — impresora / escáner Canon

Este servicio **no se despliega en Vercel**. Corre en el PC de la oficina que ve la Canon en la LAN.

## Datos del equipo

| Dato | Valor |
|------|--------|
| IP impresora/escáner | `192.168.0.121` |
| Puerto RAW impresión | `9100` |
| Driver TWAIN | `Color Network ScanGear 2` |
| Bridge | `http://localhost:5000` |

## Arranque

Desde la raíz del repo:

```bash
npm run device-bridge
```

## Escaneo — dos modos

### A) NAPS2 + TWAIN (recomendado)

1. Instala [NAPS2](https://www.naps2.com/)
2. Arranca el bridge con la ruta al ejecutable de consola:

```powershell
$env:NAPS2_PATH="C:\Program Files\NAPS2\NAPS2.Console.exe"
npm run device-bridge
```

### B) Carpeta inbox (ScanGear / SMB)

1. Configura Canon Network ScanGear para dejar JPG/PDF en:

`tool/local-device-bridge/inbox`

2. En la web pulsa **Escanear con Canon**: el bridge toma los archivos más recientes.

## Impresión RAW

`POST /api/print` envía el PDF/bytes a `192.168.0.121:9100`.

Si la Canon no acepta PDF directo en 9100, usa la impresión del navegador (`window.print`) o el driver Windows.

## Vercel

La app en Vercel sigue igual. El navegador del PC de oficina llama a `localhost:5000` (solo en esa máquina). No hace falta exponer el bridge a internet.
