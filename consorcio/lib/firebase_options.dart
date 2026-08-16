// File generated manually for Consorcio Selva MDD.
// Si agregas app Android/iOS en Firebase Console, actualiza estos IDs.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAhPO4kDvp06DVwLI9TA1u5ce1N-zimEgs',
    appId: '1:942360682235:web:917154f7502a11144a9a5e',
    messagingSenderId: '942360682235',
    projectId: 'consorcio-selva-mdd',
    authDomain: 'consorcio-selva-mdd.firebaseapp.com',
    storageBucket: 'consorcio-selva-mdd.firebasestorage.app',
  );

  // App Android registrada en Firebase Console.
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBZLEA1nZ4R-iSQVOMFAiMiOX3EGkNHXSg',
    appId: '1:942360682235:android:16121536c25e613e4a9a5e',
    messagingSenderId: '942360682235',
    projectId: 'consorcio-selva-mdd',
    storageBucket: 'consorcio-selva-mdd.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAhPO4kDvp06DVwLI9TA1u5ce1N-zimEgs',
    appId: '1:942360682235:web:917154f7502a11144a9a5e',
    messagingSenderId: '942360682235',
    projectId: 'consorcio-selva-mdd',
    storageBucket: 'consorcio-selva-mdd.firebasestorage.app',
    iosBundleId: 'com.consorcioselvamdd.tecnico',
  );
}
