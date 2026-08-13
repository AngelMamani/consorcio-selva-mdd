# App móvil técnicos — Consorcio Selva MDD

App Flutter **solo para técnicos** en campo (celular). Comparte el mismo Firebase del panel web.

## Qué puede hacer el técnico

1. Iniciar sesión
2. **Si la cuenta es nueva o le restablecieron la clave**, cambiar la contraseña temporal (obligatorio) antes de continuar
3. Ver **sus** carpetas
4. Crear carpeta + fotos (cámara o galería)
5. Abrir carpeta y seguir subiendo fotos
6. Editar nombre/descripción

No incluye módulo de usuarios ni funciones de administrador.

## Calidad (ISO/IEC 25010)

Los requisitos no funcionales del sistema completo (web + móvil) están en la raíz del monorepo:

→ [`../REQUISITOS_NO_FUNCIONALES_ISO25010.md`](../REQUISITOS_NO_FUNCIONALES_ISO25010.md)

## Estructura (Clean Architecture)

```
lib/
  domain/           # entidades, repos, casos de uso
  application/      # composition root (DI)
  infrastructure/   # Firebase Auth / Firestore / Storage
  presentation/     # pantallas móviles grandes y simples
```

## Arranque

```bash
cd consorcio
flutter pub get
flutter run
```

APK release:

```bash
flutter build apk --release
```

El APK queda en `build/app/outputs/flutter-apk/app-release.apk`.

Ícono de la app: se genera desde `assets/logo.png` con:

```bash
dart run flutter_launcher_icons
```

## Firebase Android (recomendado)

1. Firebase Console → agregar app Android
2. Package name: `com.consorcioselvamdd.tecnico`
3. Descargar `google-services.json` en `android/app/`
4. Actualizar `appId` en `lib/firebase_options.dart`

Mientras tanto la app inicializa Firebase con las opciones del proyecto `consorcio-selva-mdd`.

## Cuenta de prueba técnico

Crea el técnico desde el panel web (Administrador → Usuarios → rol Técnico).
Luego inicia sesión en el celular con ese correo/contraseña.
