// Supabase DB 타입 정의 — sql/0001_init.sql 과 동기화 유지.
// supabase gen types typescript 를 안 쓰는 대신 수동으로 관리.

export type Role = "pending" | "viewer" | "manager" | "admin";

export type EventStatus =
  | "dispatching"
  | "assigned"
  | "declined_all"
  | "completed"
  | "cancelled";

export type AssignmentStatus =
  | "notified"
  | "accepted"
  | "declined"
  | "expired"
  | "skipped";

export type ChatRoomKind = "general" | "event" | "private";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  dispatch_order: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceType {
  code: string;
  label: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface EventRow {
  id: string;
  service_type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  customer: string | null;
  address: string | null;
  size: string | null;
  layout: string | null;
  notes: string | null;
  status: EventStatus;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  manager_id: string;
  try_order: number;
  status: AssignmentStatus;
  notified_at: string;
  expires_at: string;
  responded_at: string | null;
  decline_reason: string | null;
}

export interface ChatRoom {
  id: string;
  name: string;
  kind: ChatRoomKind;
  event_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChatRoomMember {
  room_id: string;
  profile_id: string;
  joined_at: string;
  last_read_at: string | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  attachments: unknown | null;
  created_at: string;
  deleted_at: string | null;
}

// 참고: createClient 의 제네릭 타입을 안 쓰고, 각 helper 함수가 직접 반환 타입을 명시.
