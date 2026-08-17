# App móvil técnicos — Consorcio Selva MDD

App Flutter **solo para técnicos** en campo. Comparte el mismo Firebase del panel web.

## Compartir con técnicos (APK Android)

### 1. Generar el APK

```bash
cd consorcio
flutter pub get
flutter build apk --release
```

El archivo queda en:

`build/app/outputs/flutter-apk/app-release.apk`

También se copia a:

`../releases/ConsorcioTecnico-1.0.0.apk` (si ejecutas el script de build abajo).

### 2. Cómo instalarlo en el celular

1. Envía el APK por WhatsApp, Drive o USB.
2. En el teléfono: **Permitir instalar apps de origen desconocido** (para Chrome/WhatsApp/Archivos).
3. Abrir el APK → Instalar.
4. Abrir **Consorcio Técnico** e iniciar sesión con el correo del técnico.

### 3. Cuenta del técnico

Créala desde el panel web (Administrador → Usuarios → Técnico).  
Clave temporal: `87654321` (debe cambiarla al primer ingreso).

> Nota: este APK usa firma de depuración (ideal para compartir interno).  
> Para Play Store habría que crear un keystore de release.

## Arranque en desarrollo

```bash
cd consorcio
flutter pub get
flutter run
```

## Qué puede hacer el técnico (v1.1)

1. Iniciar sesión / cambiar clave temporal
2. Ver **áreas** y entrar a las carpetas de cada área
3. Ver carpetas **propias, asignadas o abiertas a todos**
4. Crear/editar carpeta con asignación: **Solo yo / Todos / Elegir técnicos**
5. Ver a quién está asignada la carpeta
6. Crear carpeta con GPS (sin fotos todavía)
7. Crear carpeta de fecha y subir fotos ahí (cámara/galería)
8. GPS de carpeta solo si aún no tiene ubicación
9. Modo oscuro propio
10. App solo en vertical

## Qué NO va en la app (queda en el panel web)

- Administrar usuarios
- CRUD de áreas
- Documentación (Excel/Word)
- Mapa Leaflet
- Eliminar carpetas/imágenes y exportar PDF (solo admin en web)

## Firebase Android

Package name: `com.consorcioselvamdd.tecnico`

Recomendado: Firebase Console → agregar app Android → `google-services.json` en `android/app/`.

## Estructura

```
lib/
  domain/
  application/
  infrastructure/
  presentation/
```
