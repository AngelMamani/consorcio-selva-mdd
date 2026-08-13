# Requisitos No Funcionales — ISO/IEC 25010

**Proyecto:** Consorcio Selva MDD  
**Alcance:** Panel web administrativo (React + TypeScript) y aplicación móvil de técnicos (Flutter)  
**Norma de referencia:** ISO/IEC 25010 — *Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*  
**Versión del documento:** 1.0  
**Fecha:** 2026-08-09

---

## 1. Propósito

Definir los **requisitos no funcionales (RNF)** del sistema bajo el modelo de calidad de producto de la norma **ISO/IEC 25010**, de forma que sean:

- Trazables (identificador único)
- Medibles o verificables
- Priorizados
- Alineados a la arquitectura Clean Architecture y a Firebase (Auth, Firestore, Storage, Cloud Functions)

Este documento complementa los requisitos funcionales de los módulos **Usuarios** y **Carpetas de imágenes**.

---

## 2. Alcance del producto

| Componente | Tecnología | Usuarios |
|---|---|---|
| Panel web | Vite, React, TypeScript, Firebase | Administradores y consulta administrativa |
| App móvil | Flutter, Firebase | Técnicos en campo |
| Backend | Firebase Auth, Firestore, Storage, Cloud Functions | Servicios compartidos |

**Fuera de alcance de este documento:** requisitos de infraestructura física del cliente, SLAs contractuales de Google Cloud no controlados por el equipo de desarrollo, y cumplimiento legal externo no declarado (salvo controles de seguridad implementados en la aplicación).

---

## 3. Modelo de calidad aplicado (ISO/IEC 25010)

Se adoptan las **ocho características de calidad del producto** y sus subcaracterísticas relevantes:

1. Adequación funcional  
2. Eficiencia de desempeño  
3. Compatibilidad  
4. Usabilidad  
5. Fiabilidad  
6. Seguridad  
7. Mantenibilidad  
8. Portabilidad  

**Prioridad:** Alta | Media | Baja  
**Estado:** Cumple | Parcial | Objetivo

---

## 4. Catálogo de requisitos no funcionales

### 4.1 Adequación funcional *(Functional Suitability)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-AF-01 | Completitud funcional | El sistema cubre autenticación, gestión de usuarios (admin), carpetas e imágenes (admin/técnico) en web y móvil según rol. | 100 % de los casos de uso prioritarios del alcance actual ejecutables de punta a punta. | Alta | Cumple |
| RNF-AF-02 | Corrección funcional | Las operaciones de negocio no alteran datos inconsistentes (conteo de imágenes, ownership, roles). | Tras crear/editar/subir, el estado en Firestore coincide con la UI sin discrepancias observables. | Alta | Cumple |
| RNF-AF-03 | Pertinencia funcional | La app móvil expone solo funciones de técnico; el panel web restringe administración de usuarios a `ADMINISTRADOR`. | Intentos de acceso no autorizado son bloqueados en UI y en reglas de seguridad. | Alta | Cumple |

---

### 4.2 Eficiencia de desempeño *(Performance Efficiency)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-ED-01 | Comportamiento temporal | El login y la carga inicial de listados (usuarios/carpetas) responden en tiempo razonable en red normal. | Tiempo percibido de carga de listados ≤ 3 s en condiciones de red típica (4G/Wi‑Fi). | Alta | Parcial |
| RNF-ED-02 | Utilización de recursos | Las vistas de galería y listados evitan renderizar cargas innecesarias (paginación visual, grids compactos, proxies locales para PDF). | No se bloquea la UI de forma prolongada al navegar listados medianos (&lt; 200 ítems). | Media | Parcial |
| RNF-ED-03 | Capacidad | El sistema soporta operación concurrente de varios técnicos subiendo imágenes a carpetas propias. | Sin errores de escritura atribuibles a diseño de datos bajo carga moderada de campo. | Media | Objetivo |

---

### 4.3 Compatibilidad *(Compatibility)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-CO-01 | Coexistencia | Web y móvil coexisten sobre el mismo proyecto Firebase sin conflicto de esquemas. | Ambos clientes leen/escriben las mismas colecciones (`users`, `folders`, `folderImages`) con el mismo contrato. | Alta | Cumple |
| RNF-CO-02 | Interoperabilidad | Integración estándar con Firebase Auth, Firestore, Storage y Cloud Functions. | Operaciones críticas (crear usuario, restablecer clave temporal, storage) funcionan vía SDK/Functions documentadas. | Alta | Cumple |
| RNF-CO-03 | Compatibilidad de navegadores | El panel web funciona en navegadores modernos Chromium/Firefox/Safari recientes. | Sin errores de consola bloqueantes en las últimas dos versiones mayores de Chrome y Edge. | Media | Parcial |

---

### 4.4 Usabilidad *(Usability)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-US-01 | Reconocibilidad de adecuación | La interfaz identifica el producto (marca, roles, módulos) y el propósito de cada pantalla. | Un usuario nuevo identifica en ≤ 1 min dónde gestionar usuarios o carpetas. | Alta | Cumple |
| RNF-US-02 | Aprendizaje | Flujos principales (login, crear carpeta, subir imágenes, crear usuario) son guiados y consistentes. | Acciones primarias visibles; formularios con validación y mensajes claros. | Alta | Cumple |
| RNF-US-03 | Operabilidad | Vistas cartas/lista, búsqueda, filtros y acciones soft en Usuarios y Carpetas. | El usuario puede filtrar/buscar y cambiar de vista sin recargar la aplicación. | Alta | Cumple |
| RNF-US-04 | Protección contra errores de usuario | Validación de formularios, confirmaciones en acciones sensibles y contraseña temporal forzada. | No se permite completar alta de usuario sin datos mínimos; reset de clave exige confirmación. | Alta | Cumple |
| RNF-US-05 | Estética de la interfaz | Diseño coherente (tema claro/oscuro, tipografía, densidad compacta, layout admin). | Misma familia visual en layout, listados y detalle; sin estilos contradictorios evidentes. | Media | Cumple |
| RNF-US-06 | Accesibilidad | Controles con foco visible, iconos con `aria-hidden` donde corresponde, contraste usable. | Navegación por teclado en acciones principales del panel web; contraste legible en ambos temas. | Media | Parcial |

---

### 4.5 Fiabilidad *(Reliability)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-FI-01 | Madurez | Errores de dominio se mapean a mensajes comprensibles (`DomainError` / excepciones de dominio). | Fallos de Auth/Firestore no muestran stack traces al usuario final. | Alta | Cumple |
| RNF-FI-02 | Disponibilidad | La disponibilidad del servicio depende de Firebase; la app degrada con mensajes ante fallos de red. | Ante pérdida de conexión se informa el error y no se corrompe el estado local crítico. | Alta | Parcial |
| RNF-FI-03 | Tolerancia a fallos | Operaciones de escritura fallidas no dejan la UI en estado inconsistente irreversible. | Tras error de subida/creación, el usuario puede reintentar sin reiniciar la sesión. | Alta | Parcial |
| RNF-FI-04 | Recuperabilidad | Sesión Firebase y rutas protegidas permiten retomar el trabajo tras recarga del navegador. | Recargar la web con sesión válida restaura el contexto de autenticación. | Alta | Cumple |

---

### 4.6 Seguridad *(Security)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-SE-01 | Confidencialidad | Acceso solo con autenticación; técnicos solo ven sus carpetas/imágenes/storage; admin gestiona usuarios. | Verificado por `firestore.rules` / `storage.rules` y rutas protegidas en UI. | Alta | Cumple |
| RNF-SE-02 | Integridad | Alta de usuarios solo vía Cloud Functions (Admin SDK). Reglas impiden create cliente de `users`, cambios de `ownerId` y lecturas cruzadas de imágenes. | Un técnico no puede crear usuarios ni leer carpetas ajenas; el cliente no puede inventar perfiles Auth/Firestore. | Alta | Cumple |
| RNF-SE-03 | No-repudio | Acciones sensibles quedan asociadas a `ownerId` / `uploadedById` y UID de Auth. | Toda carpeta/imagen nueva registra el usuario responsable. | Media | Cumple |
| RNF-SE-04 | Responsabilidad (accountability) | Roles `ADMINISTRADOR` y `TECNICO` con permisos diferenciados en UI, dominio y reglas. | Matriz rol–acción verificable en rules, Functions y casos de uso. | Alta | Cumple |
| RNF-SE-05 | Autenticidad | Firebase Authentication; clave temporal aleatoria de un solo uso; cambio forzado (`mustChangePassword`); política de contraseña reforzada (10+ mayúscula/minúscula/número). | Usuario temporal no opera módulos hasta cambiar contraseña; cuentas inactivas cierran sesión Auth. | Alta | Cumple |
| RNF-SE-06 | Protección de secretos | Credenciales no versionadas (`.env`); headers de seguridad en Hosting (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). | Repositorio sin secretos reales; headers configurados en `firebase.json`. | Alta | Cumple |

---

### 4.7 Mantenibilidad *(Maintainability)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-MA-01 | Modularidad | Separación en capas Domain / Application / Infrastructure / Presentation (web y Flutter). | El dominio no importa React, Flutter UI ni SDKs de Firebase. | Alta | Cumple |
| RNF-MA-02 | Reusabilidad | Casos de uso y repositorios (puertos) reutilizables entre presentaciones. | Misma semántica de negocio en web y móvil vía contratos de dominio. | Alta | Cumple |
| RNF-MA-03 | Analizabilidad | Estructura de carpetas predecible y tipado estático (TypeScript / Dart). | `npm run build` y análisis Flutter sin errores de tipo en la línea base. | Alta | Cumple |
| RNF-MA-04 | Modificabilidad | Agregar un caso de uso no requiere reescribir la UI completa. | Nuevo use case + wiring en composition root + pantalla/adaptador. | Alta | Cumple |
| RNF-MA-05 | Capacidad de prueba | Dominio desacoplado facilita pruebas unitarias de reglas de negocio. | Casos de uso testables con dobles de repositorio (objetivo de cobertura incremental). | Media | Objetivo |

---

### 4.8 Portabilidad *(Portability)*

| ID | Subcaracterística | Requisito | Criterio de aceptación | Prioridad | Estado |
|---|---|---|---|---|---|
| RNF-PO-01 | Adaptabilidad | Panel web responsivo (desktop/móvil); app Flutter orientada a teléfono. | Layout admin usable en viewport móvil; app técnica operable en Android. | Alta | Cumple |
| RNF-PO-02 | Facilidad de instalación | Arranque documentado (`npm install`, `flutter pub get`, variables de entorno, bootstrap admin). | Un desarrollador nuevo puede levantar el entorno siguiendo el README. | Alta | Cumple |
| RNF-PO-03 | Reemplazabilidad | Firebase queda aislado en Infrastructure; el dominio no depende del proveedor. | Sustituir un adaptador Firebase no altera entidades ni casos de uso. | Media | Cumple |

---

## 5. Calidad en uso (complemento ISO/IEC 25010)

Además del modelo de calidad del producto, se consideran estos objetivos de **calidad en uso**:

| ID | Característica | Objetivo | Indicador |
|---|---|---|---|
| RNF-CU-01 | Eficacia | El técnico registra evidencia fotográfica en campo sin asistencia continua. | Flujo login → carpeta → fotos completado en una sesión típica. |
| RNF-CU-02 | Eficiencia | El administrador gestiona usuarios y revisa carpetas con pocos clics. | Alta de usuario y revisión de carpeta en ≤ 5 interacciones principales. |
| RNF-CU-03 | Satisfacción | Interfaz clara, densa y coherente con la marca del consorcio. | Feedback cualitativo de usuarios piloto sin bloqueos de usabilidad críticos. |
| RNF-CU-04 | Libertad de riesgo | Controles de acceso reducen riesgo de exposición o alteración indebida de datos. | Cero hallazgos críticos abiertos en reglas de seguridad del alcance actual. |
| RNF-CU-05 | Cobertura de contexto | Web para oficina/admin; móvil para campo. | Ambos contextos cubiertos por clientes dedicados. |

---

## 6. Matriz de trazabilidad resumida

| Característica ISO 25010 | IDs principales | Evidencia en el sistema |
|---|---|---|
| Adequación funcional | RNF-AF-01…03 | Módulos Usuarios/Carpetas, roles, app técnica |
| Eficiencia de desempeño | RNF-ED-01…03 | Listados, proxy PDF, grids compactos |
| Compatibilidad | RNF-CO-01…03 | Firebase compartido, SDKs oficiales |
| Usabilidad | RNF-US-01…06 | Layout admin, vistas cartas/lista, temas, validaciones |
| Fiabilidad | RNF-FI-01…04 | Manejo de errores de dominio, sesión persistente |
| Seguridad | RNF-SE-01…06 | Auth, rules, roles, clave temporal, `.env` |
| Mantenibilidad | RNF-MA-01…05 | Clean Architecture, TypeScript/Dart |
| Portabilidad | RNF-PO-01…03 | Responsive, Flutter Android, adaptadores |

---

## 7. Restricciones y supuestos

1. La disponibilidad y latencia globales dependen del SLA de Firebase/Google Cloud.  
2. El primer administrador se crea por bootstrap manual (Auth + documento Firestore).  
3. CORS de Storage en producción debe configurarse según `storage.cors.json` / README.  
4. La app móvil prioriza Android para técnicos en campo.  
5. Los RNF marcados como **Objetivo** o **Parcial** constituyen mejora continua planificada.

---

## 8. Verificación y validación

| Método | Aplicación |
|---|---|
| Revisión de arquitectura | Cumplimiento de dependencias hacia el dominio |
| Pruebas manuales exploratorias | Flujos admin y técnico (web/móvil) |
| Inspección de reglas | `firestore.rules`, `storage.rules`, Functions |
| Build/CI local | `npm run build`, `flutter analyze` / build APK |
| Checklist de aceptación | Criterios de la sección 4 por ID |

---

## 9. Glosario breve

| Término | Definición |
|---|---|
| RNF | Requisito no funcional |
| ISO/IEC 25010 | Norma de modelos de calidad de sistemas y software |
| Clean Architecture | Organización por capas con el dominio en el centro |
| Caso de uso | Orquestación de una intención de negocio en el dominio |

---

## 10. Control de cambios

| Versión | Fecha | Descripción |
|---|---|---|
| 1.0 | 2026-08-09 | Versión inicial de RNF alineados a ISO/IEC 25010 para Consorcio Selva MDD |
| 1.1 | 2026-08-10 | Seguridad aplicada: rules endurecidas, Functions de alta/reset, política de claves, logout de inactivos, headers Hosting |
