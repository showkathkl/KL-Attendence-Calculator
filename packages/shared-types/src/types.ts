// Domain Models

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  student_id: string;
  name: string;
  roll_number: string;
  department: string;
  semester: number;
  cgpa?: number;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  course_code: string;
  course_name: string;
  faculty_name?: string;
  category?: "Lecture" | "Tutorial" | "Practical" | "Skill" | "Other";
  target_attendance?: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  course_id: string;
  date: string;
  status: "present" | "absent" | "leave";
  category: "Lecture" | "Tutorial" | "Practical" | "Skill" | "Other";
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummary {
  id: string;
  user_id: string;
  course_id: string;
  attended: number;
  conducted: number;
  percentage: number;
  category?: string;
  last_synced: string;
  created_at: string;
  updated_at: string;
}

export interface TimetableEntry {
  id: string;
  user_id: string;
  course_id: string;
  day_of_week: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  start_time: string;
  end_time: string;
  room?: string;
  faculty_name?: string;
  is_cancelled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncStatus {
  id: string;
  user_id: string;
  last_synced: string;
  last_sync_status: "success" | "failed" | "pending";
  last_sync_error?: string;
  sync_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  attendance_target: number;
  theme: "light" | "dark" | "system";
  notifications_enabled: boolean;
  erp_connected: boolean;
  demo_mode: boolean;
  created_at: string;
  updated_at: string;
}

// ERP Integration

export interface ERPAuthInput {
  username: string;
  password: string;
  captcha_solution?: string;
  mfa_code?: string;
}

export interface ERPSession {
  session_id: string;
  authenticated: boolean;
  expires_at: string;
  student_id?: string;
  requires_captcha?: boolean;
  requires_mfa?: boolean;
  mfa_challenge_id?: string;
}

export interface StudentProfileFromERP {
  student_id: string;
  name: string;
  roll_number: string;
  department: string;
  semester: number;
  cgpa?: number;
}

export interface ERPAttendanceData {
  courses: ERPCourse[];
  fetched_at: string;
  sync_status: "success" | "partial" | "failed";
}

export interface ERPAttendanceComponent {
  name: "Lecture" | "Tutorial" | "Practical" | "Skill" | "Other";
  attended: number;
  conducted: number;
  percentage: number;
}

export interface ERPCourse {
  course_code: string;
  course_name: string;
  faculty_name?: string;
  category?: string;
  attended: number;
  conducted: number;
  percentage: number;
  components?: ERPAttendanceComponent[];
}

export interface ERPTimetableData {
  entries: ERPTimetableEntry[];
  fetched_at: string;
  academic_year?: string;
  semester?: number;
}

export interface ERPTimetableEntry {
  course_code: string;
  course_name: string;
  component: "Lecture" | "Tutorial" | "Practical" | "Skill" | "Other";
  day_of_week: string;
  start_time: string;
  end_time: string;
  period?: number;
  period_label?: string;
  room?: string;
  faculty_name?: string;
}

// API Responses

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Error Codes

export const ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ERP_UNAVAILABLE: "ERP_UNAVAILABLE",
  ERP_SESSION_EXPIRED: "ERP_SESSION_EXPIRED",
  CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",
  MFA_REQUIRED: "MFA_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  ATTENDANCE_PARSE_ERROR: "ATTENDANCE_PARSE_ERROR",
  INVALID_IMPORT: "INVALID_IMPORT",
  OCR_FAILED: "OCR_FAILED",
  DATABASE_ERROR: "DATABASE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
