export type Align = "right" | "center" | "left";

export interface Coords {
  x: number; // مركز المربع أفقيا (% من عرض الشهادة)
  y: number; // مركز المربع عموديا (% من ارتفاع الشهادة)
  size: number; // حجم الخط (% من عرض الشهادة)
  color: string;
  align: Align;
  w: number; // عرض المربع (% من عرض الشهادة)
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  event_date: string;
  end_time: string;
  status: "active" | "ended";
  created_at: string;
}

export interface Activity {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  duration: string | null;
  sessions_count: number;
  location: string | null;
  room_number: string | null;
  has_certificate: boolean;
  certificate_content: string | null;
  certificate_template_url: string | null;
  name_coords: Coords | null;
  content_coords: Coords | null;
  is_started: boolean;
  events?: EventRow;
}

export interface Student {
  id: string;
  full_name: string;
  is_school_student: boolean;
  grade_level: string | null;
  username: string;
}

export interface Registration {
  id: string;
  activity_id: string;
  student_id: string | null;
  manual_student_name: string | null;
  manual_is_school_student: boolean | null;
  manual_grade_level: string | null;
  attendance_sessions: Record<string, boolean>;
  certificate_issued: boolean;
  issued_at: string | null;
  created_at: string;
  students?: Student | null;
  activities?: Activity | null;
}

export interface ArchiveStudent {
  name: string;
  is_school_student: boolean | null;
  grade_level: string | null;
  attendance: Record<string, boolean>;
  certificate_issued: boolean;
}

export interface ArchiveRow {
  id: string;
  activity_id: string | null;
  event_title: string | null;
  activity_title: string | null;
  activity_description: string | null;
  activity_date: string | null;
  attendance_snapshot: { sessions_count?: number; students?: ArchiveStudent[] };
  updated_at: string;
}

export const DEFAULT_NAME_COORDS: Coords = {
  x: 50,
  y: 45,
  size: 4,
  color: "#1B2A6B",
  align: "center",
  w: 70,
};
export const DEFAULT_CONTENT_COORDS: Coords = {
  x: 50,
  y: 62,
  size: 2.2,
  color: "#222222",
  align: "center",
  w: 70,
};
