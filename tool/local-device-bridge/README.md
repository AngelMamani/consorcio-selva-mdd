# Bridge local — impresora / escáner Canon

Este servicio **no se despliega en Vercel**. Corre en **cada PC** de la oficina que vaya a escanear (misma LAN que la Canon).

La IP de la Canon, el puerto y el driver se guardan en Firebase (`settings/officeDevices`) para que todos vean la misma config. El bridge sigue siendo local.

## Datos del equipo (compartidos en la nube)

| Dato | Valor típico |
|------|----------------|
| IP impresora/escáner | `192.168.0.121` |
| Puerto RAW impresión | `9100` |
| Driver | `Color Network ScanGear 2` |
| Bridge en este PC | `http://localhost:5000` |

Un admin guarda esos valores en la web con **Guardar config de oficina**. No hace falta poner la IP de cada colega.

## Arranque en cada PC (colegas)

1. Instala [NAPS2](https://www.naps2.com/) (modo WIA, igual que la app Escáner de Windows).
2. Desde la raíz del repo, o con el acceso directo:

```bash
npm run device-bridge
```

o doble clic en `Iniciar-Bridge-Consorcio.cmd` / `start-bridge.cmd`.

3. Deja la ventana abierta mientras escaneas.
4. En Chrome (Vercel), **Permitir** acceso a red local / otras aplicaciones cuando lo pida.
5. En la web: **Probar bridge** → debe decir OK → **Escanear con Canon**.

## Escaneo — dos modos

### A) NAPS2 + WIA (recomendado, como Windows Escáner)

Configura en la web: modo **WIA**, origen **Alimentador**, driver `Color Network ScanGear 2`.

```powershell
$env:NAPS2_PATH="C:\Program Files\NAPS2\NAPS2.Console.exe"
npm run device-bridge
```

### B) Carpeta inbox (ScanGear / SMB)

1. Configura Canon Network ScanGear para dejar JPG/PDF en:

`tool/local-device-bridge/inbox`

2. En la web pulsa **Escanear con Canon**: el bridge toma los archivos más recientes.

## Impresión RAW

`POST /api/print` envía el PDF/bytes a la IP de oficina (p. ej. `192.168.0.121:9100`).

Si la Canon no acepta PDF directo en 9100, usa la impresión del navegador (`window.print`) o el driver Windows.

## Vercel

La app en Vercel solo muestra la UI y lee la config de Firebase. El navegador de **este PC** llama a `localhost:5000`. No hay que exponer el bridge a internet.
