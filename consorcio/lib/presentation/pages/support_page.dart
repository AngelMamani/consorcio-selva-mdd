import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/support_ticket.dart';
import '../../domain/errors/domain_exception.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';

class SupportPage extends StatefulWidget {
  const SupportPage({super.key});

  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  final _messageController = TextEditingController();
  String _kind = 'PROBLEMA';
  List<SupportTicket> _tickets = [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tickets = await deps.listSupportTicketsUseCase.execute(user);
      if (!mounted) return;
      setState(() {
        _tickets = tickets;
        _loading = false;
      });
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudieron cargar los avisos';
        _loading = false;
      });
    }
  }

  Future<void> _send() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _sending) return;
    setState(() => _sending = true);
    try {
      await deps.createSupportTicketUseCase.execute(
        user,
        kind: _kind,
        message: _messageController.text,
      );
      if (!mounted) return;
      _messageController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aviso enviado. Te daremos soporte.')),
      );
      await _load();
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo enviar el aviso')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _resolve(SupportTicket ticket) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || !user.isMobileAdmin) return;

    final controller = TextEditingController(text: ticket.response);
    final response = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Responder y resolver'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: 'Respuesta para el técnico',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Resolver'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (response == null || !mounted) return;

    try {
      await deps.resolveSupportTicketUseCase.execute(
        user,
        ticketId: ticket.id,
        response: response,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aviso resuelto')),
      );
      await _load();
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final isAdmin = session.user?.isMobileAdmin == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Soporte'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.brandBlue, AppTheme.brandGreen],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sugerencias y problemas',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Cuéntanos qué mejorar o qué te impide trabajar. El equipo te da soporte.',
                    style: TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Nuevo aviso',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('Problema'),
                          selected: _kind == 'PROBLEMA',
                          onSelected: (_) => setState(() => _kind = 'PROBLEMA'),
                        ),
                        ChoiceChip(
                          label: const Text('Sugerencia'),
                          selected: _kind == 'SUGERENCIA',
                          onSelected: (_) =>
                              setState(() => _kind = 'SUGERENCIA'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _messageController,
                      maxLines: 4,
                      maxLength: 1000,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: _kind == 'PROBLEMA'
                            ? 'Qué pasó, en qué pantalla y qué necesitas'
                            : 'Qué te gustaría mejorar en el aplicativo',
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _sending ? null : _send,
                        icon: const Icon(Icons.send_rounded),
                        label: Text(_sending ? 'Enviando...' : 'Enviar aviso'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isAdmin ? 'Avisos del equipo' : 'Tus avisos',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(_error!, textAlign: TextAlign.center),
              )
            else if (_tickets.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: Text(
                  'Aún no hay avisos.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._tickets.map((ticket) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Chip(
                              label: Text(ticket.kindLabel),
                              visualDensity: VisualDensity.compact,
                            ),
                            const SizedBox(width: 6),
                            Chip(
                              label: Text(ticket.statusLabel),
                              visualDensity: VisualDensity.compact,
                              backgroundColor: ticket.isOpen
                                  ? const Color(0xFFFFECB3)
                                  : const Color(0xFFE8F5E9),
                            ),
                            const Spacer(),
                            Text(
                              _formatWhen(ticket.createdAt),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        if (isAdmin) ...[
                          const SizedBox(height: 4),
                          Text(
                            ticket.createdByName,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                        const SizedBox(height: 6),
                        Text(ticket.message),
                        if (ticket.response.trim().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Respuesta: ${ticket.response}',
                            style: const TextStyle(
                              color: Color(0xFF2E7D32),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        if (isAdmin && ticket.isOpen) ...[
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () => _resolve(ticket),
                              child: const Text('Responder'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  String _formatWhen(DateTime date) {
    final local = date.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month $hour:$minute';
  }
}
