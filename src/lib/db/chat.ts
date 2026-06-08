import { supabase } from "../supabase";
import type { ChatMessage, ChatRoom, ChatRoomKind, Profile } from "./types";

export interface ChatRoomWithUnread extends ChatRoom {
  unread: number;
  last_message?: ChatMessage;
}

export async function listMyChatRooms(): Promise<ChatRoom[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  // 본인이 멤버인 방 + general 방 전부
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*, chat_room_members!inner(profile_id)")
    .eq("chat_room_members.profile_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // 멤버가 아닐 수도 있는 general 방 fallback
    const { data: general, error: err2 } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("kind", "general")
      .order("created_at", { ascending: false });
    if (err2) throw err2;
    return general ?? [];
  }
  return (data ?? []) as ChatRoom[];
}

export async function listAllChatRooms(): Promise<ChatRoom[]> {
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChatRoom(
  name: string,
  kind: ChatRoomKind = "general",
  memberIds: string[] = []
): Promise<ChatRoom> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert({ name, kind, created_by: auth.user.id } as never)
    .select()
    .single();
  if (error) throw error;

  const ids = Array.from(new Set([auth.user.id, ...memberIds]));
  if (ids.length > 0) {
    const { error: err2 } = await supabase
      .from("chat_room_members")
      .insert(ids.map((id) => ({ room_id: room.id, profile_id: id })) as never);
    if (err2) console.error("[chat.createChatRoom] add members failed", err2);
  }
  return room;
}

export async function listMessages(roomId: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse(); // 오래된 것 → 최신 순으로
}

export async function sendMessage(roomId: string, body: string): Promise<ChatMessage> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("빈 메시지");
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      room_id: roomId,
      sender_id: auth.user.id,
      body: trimmed,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markRoomRead(roomId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from("chat_room_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("profile_id", auth.user.id);
  if (error) console.error("[chat.markRoomRead]", error);
}

export function subscribeToRoom(
  roomId: string,
  onMessage: (msg: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// 멤버 ID 목록의 프로필 정보 한꺼번에 조회 (메시지 표시용)
export async function getProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  const map = new Map<string, Profile>();
  for (const p of data ?? []) map.set(p.id, p);
  return map;
}
