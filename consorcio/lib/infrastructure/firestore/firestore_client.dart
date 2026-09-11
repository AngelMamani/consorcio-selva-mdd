import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/errors/domain_exception.dart';

/// Ajusta Firestore para redes lentas (datos / WiFi saturado).
void configureFirestoreForSlowNetworks() {
  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: 40 * 1024 * 1024,
  );
}

const _slowNetworkMessage =
    'La red está lenta. Revisa datos/WiFi e intenta de nuevo.';

/// Lee primero la caché local (aunque el doc no exista); refresca servidor
/// en segundo plano. Si no hay caché, espera al servidor con tope.
Future<DocumentSnapshot<T>> getFast<T>(
  DocumentReference<T> ref, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  DocumentSnapshot<T>? cached;
  try {
    cached = await ref.get(const GetOptions(source: Source.cache));
  } catch (_) {}

  if (cached != null) {
    unawaited(ref.get(const GetOptions(source: Source.server)));
    return cached;
  }

  try {
    return await ref.get().timeout(timeout);
  } on TimeoutException {
    try {
      return await ref.get(const GetOptions(source: Source.cache));
    } catch (_) {
      throw DomainException(_slowNetworkMessage);
    }
  } on FirebaseException catch (error) {
    if (error.code == 'unavailable' || error.code == 'deadline-exceeded') {
      throw DomainException(_slowNetworkMessage);
    }
    rethrow;
  }
}

/// Igual que [getFast] para consultas: una lista vacía en caché es válida
/// (no fuerza ida al servidor).
Future<QuerySnapshot<T>> queryFast<T>(
  Query<T> query, {
  Duration timeout = const Duration(seconds: 10),
}) async {
  QuerySnapshot<T>? cached;
  try {
    cached = await query.get(const GetOptions(source: Source.cache));
  } catch (_) {}

  if (cached != null) {
    unawaited(query.get(const GetOptions(source: Source.server)));
    return cached;
  }

  try {
    return await query.get().timeout(timeout);
  } on TimeoutException {
    try {
      return await query.get(const GetOptions(source: Source.cache));
    } catch (_) {
      throw DomainException(_slowNetworkMessage);
    }
  } on FirebaseException catch (error) {
    if (error.code == 'unavailable' || error.code == 'deadline-exceeded') {
      throw DomainException(_slowNetworkMessage);
    }
    rethrow;
  }
}

/// Escribe y no se queda colgado si el servidor no responde.
/// En red opaca el dato queda en cola local y se sube luego.
Future<void> setQueued<T>(
  DocumentReference<T> ref,
  T data, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  try {
    await ref.set(data).timeout(timeout);
  } on TimeoutException {
    // La escritura ya está en cola. No bloquear al técnico.
  }
}
