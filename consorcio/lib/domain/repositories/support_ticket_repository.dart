import '../entities/support_ticket.dart';

abstract class SupportTicketRepository {
  Future<SupportTicket> create({
    required String kind,
    required String message,
    required String createdById,
    required String createdByName,
  });

  Future<List<SupportTicket>> listMine(String userId);

  Future<List<SupportTicket>> listAll();

  Future<SupportTicket> resolve({
    required String ticketId,
    required String response,
    required String resolvedById,
    required String resolvedByName,
  });
}
