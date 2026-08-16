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

## Qué puede hacer el técnico

1. Iniciar sesión / cambiar clave temporal
2. Ver y buscar **sus** carpetas
3. Crear carpeta con GPS + fotos
4. Subir más fotos (GPS al subir)
5. Modo oscuro propio
6. App solo en vertical

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
