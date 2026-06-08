import { supabase } from "../supabase";
import type { Profile, Role } from "./types";

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("[profiles.getMyProfile]", error);
    return null;
  }
  return data;
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("dispatch_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listActiveManagers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "manager")
    .eq("active", true)
    .order("dispatch_order", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateProfileSelf(patch: {
  name?: string;
  phone?: string;
}): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", auth.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// admin only
export async function setProfileRole(profileId: string, role: Role): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setProfileActive(profileId: string, active: boolean): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setProfileDispatchOrder(
  profileId: string,
  dispatch_order: number | null
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ dispatch_order })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
