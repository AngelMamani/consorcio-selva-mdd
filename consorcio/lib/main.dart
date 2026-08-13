import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'application/composition_root.dart';
import 'firebase_options.dart';
import 'presentation/state/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  final dependencies = createAppDependencies();

  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: dependencies),
        ChangeNotifierProvider(
          create: (_) => SessionController(dependencies),
        ),
      ],
      child: const ConsorcioApp(),
    ),
  );
}
