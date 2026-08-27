import '../entities/app_user.dart';
import '../entities/support_ticket.dart';
import '../errors/domain_exception.dart';
import '../repositories/support_ticket_repository.dart';

const _kinds = {'SUGERENCIA', 'PROBLEMA'};

class CreateSupportTicketUseCase {
  CreateSupportTicketUseCase(this._repository);

  final SupportTicketRepository _repository;

  Future<SupportTicket> execute(
    AppUser actor, {
    required String kind,
    required String message,
  }) async {
    actor.assertCanOperateApp();
    final nextKind = kind.trim().toUpperCase();
    if (!_kinds.contains(nextKind)) {
      throw DomainException('Elige si es sugerencia o problema');
    }
    final text = message.trim();
    if (text.length < 8) {
      throw DomainException('Describe el aviso con al menos 8 caracteres');
    }
    if (text.length > 1000) {
      throw DomainException('El aviso es demasiado largo');
    }
    return _repository.create(
      kind: nextKind,
      message: text,
      createdById: actor.id,
      createdByName: actor.displayName,
    );
  }
}

class ListSupportTicketsUseCase {
  ListSupportTicketsUseCase(this._repository);

  final SupportTicketRepository _repository;

  Future<List<SupportTicket>> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    if (actor.isMobileAdmin) {
      return _repository.listAll();
    }
    return _repository.listMine(actor.id);
  }
}

class ResolveSupportTicketUseCase {
  ResolveSupportTicketUseCase(this._repository);

  final SupportTicketRepository _repository;

  Future<SupportTicket> execute(
    AppUser actor, {
    required String ticketId,
    required String response,
  }) async {
    actor.assertCanOperateApp();
    if (!actor.isMobileAdmin) {
      throw DomainException('Solo el administrador puede responder el aviso');
    }
    final text = response.trim();
    if (text.length > 1000) {
      throw DomainException('La respuesta es demasiado larga');
    }
    return _repository.resolve(
      ticketId: ticketId.trim(),
      response: text,
      resolvedById: actor.id,
      resolvedByName: actor.displayName,
    );
  }
}
