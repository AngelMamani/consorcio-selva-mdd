import '../entities/app_user.dart';
import '../entities/attendance_settings.dart';
import '../repositories/attendance_repository.dart';

class GetAttendanceSettingsUseCase {
  GetAttendanceSettingsUseCase(this._attendanceRepository);

  final AttendanceRepository _attendanceRepository;

  Future<AttendanceSettings> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    return _attendanceRepository.getSettings();
  }
}
