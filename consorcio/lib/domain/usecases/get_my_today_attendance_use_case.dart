import '../entities/app_user.dart';
import '../entities/attendance.dart';
import '../repositories/attendance_repository.dart';

class GetMyTodayAttendanceUseCase {
  GetMyTodayAttendanceUseCase(this._attendanceRepository);

  final AttendanceRepository _attendanceRepository;

  Future<Attendance?> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    return _attendanceRepository.getByUserAndDate(actor.id, limaDateKey());
  }
}
