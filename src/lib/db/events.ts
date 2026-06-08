import { supabase } from "../supabase";
import type { EventAssignment, EventRow, ServiceType } from "./types";

export async function listServiceTypes(): Promise<ServiceType[]> {
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface CreateEventInput {
  service_type: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  customer?: string | null;
  address?: string | null;
  size?: string | null;
  layout?: string | null;
  notes?: string | null;
}

export async function createEvent(input: CreateEventInput): Promise<EventRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");
  const { data, error } = await supabase
    .from("events")
    .insert({
      ...input,
      created_by: auth.user.id,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  id: string,
  patch: Partial<CreateEventInput>
): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelEvent(id: string): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeEvent(id: string): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update({ status: "completed" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAssignmentsForEvent(eventId: string): Promise<EventAssignment[]> {
  const { data, error } = await supabase
    .from("event_assignments")
    .select("*")
    .eq("event_id", eventId)
    .order("try_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMyPendingAssignments(): Promise<EventAssignment[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("event_assignments")
    .select("*")
    .eq("manager_id", auth.user.id)
    .eq("status", "notified")
    .order("notified_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function acceptAssignment(assignmentId: string): Promise<EventAssignment> {
  const { data, error } = await supabase.rpc("fn_accept_assignment" as never, {
    p_assignment_id: assignmentId,
  } as never);
  if (error) throw error;
  return data as EventAssignment;
}

export async function declineAssignment(
  assignmentId: string,
  reason?: string
): Promise<EventAssignment> {
  const { data, error } = await supabase.rpc("fn_decline_assignment" as never, {
    p_assignment_id: assignmentId,
    p_reason: reason ?? null,
  } as never);
  if (error) throw error;
  return data as EventAssignment;
}
