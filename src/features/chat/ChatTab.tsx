import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../store/AuthProvider";
import {
  createChatRoom,
  getProfilesByIds,
  listMessages,
  listMyChatRooms,
  markRoomRead,
  sendMessage,
  subscribeToRoom,
} from "../../lib/db/chat";
import { listProfiles } from "../../lib/db/profiles";
import type { ChatMessage, ChatRoom, Profile } from "../../lib/db/types";

export function ChatTab() {
  const { user, role } = useAuth();
  const { show } = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const isAdmin = role === "admin";

  const refreshRooms = useCallback(async () => {
    try {
      const list = await listMyChatRooms();
      setRooms(list);
      if (!currentRoomId && list.length > 0) {
        setCurrentRoomId(list[0].id);
      }
    } catch (err) {
      console.error("[chat.refreshRooms]", err);
      show(err instanceof Error ? err.message : "방 불러오기 실패");
    }
  }, [currentRoomId, show]);

  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === currentRoomId) ?? null,
    [rooms, currentRoomId]
  );

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col gap-2 pb-2">
      <div className="flex items-center justify-between gap-2">
        <select
          value={currentRoomId ?? ""}
          onChange={(e) => setCurrentRoomId(e.target.value || null)}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          {rooms.length === 0 && <option value="">방 없음</option>}
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.kind === "general" ? "📢 " : r.kind === "event" ? "🛠 " : "💬 "}
              {r.name}
            </option>
          ))}
        </select>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex-shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            + 방
          </button>
        )}
      </div>

      {currentRoom ? (
        <RoomView key={currentRoom.id} room={currentRoom} myUserId={user?.id} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">
          채팅방이 없습니다.
        </div>
      )}

      {createOpen && (
        <CreateRoomModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            refreshRooms();
          }}
        />
      )}
    </div>
  );
}

interface RoomViewProps {
  room: ChatRoom;
  myUserId: string | undefined;
}

function RoomView({ room, myUserId }: RoomViewProps) {
  const { show } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadProfiles = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const map = await getProfilesByIds(ids);
    setProfileMap((prev) => {
      const next = new Map(prev);
      for (const [k, v] of map) next.set(k, v);
      return next;
    });
  }, []);

  // 메시지 초기 로드
  useEffect(() => {
    let mounted = true;
    listMessages(room.id, 200)
      .then((list) => {
        if (!mounted) return;
        setMessages(list);
        loadProfiles(Array.from(new Set(list.map((m) => m.sender_id))));
      })
      .catch((err) => {
        console.error(err);
        if (mounted) show(err instanceof Error ? err.message : "메시지 불러오기 실패");
      });
    markRoomRead(room.id);
    return () => {
      mounted = false;
    };
  }, [room.id, loadProfiles, show]);

  // 실시간 구독
  useEffect(() => {
    const off = subscribeToRoom(room.id, (m) => {
      setMessages((prev) => [...prev, m]);
      loadProfiles([m.sender_id]);
    });
    return off;
  }, [room.id, loadProfiles]);

  // 새 메시지 들어오면 스크롤 하단으로
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await sendMessage(room.id, body);
      setBody("");
      markRoomRead(room.id);
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "전송 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto p-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            첫 메시지를 남겨보세요.
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === myUserId;
            const sender = profileMap.get(m.sender_id);
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%]">
                  {!isMine && (
                    <div className="mb-0.5 text-[10px] text-neutral-500">
                      {sender?.name || sender?.email || "?"}
                    </div>
                  )}
                  <div
                    className={[
                      "whitespace-pre-line rounded-2xl px-3 py-1.5 text-sm leading-relaxed",
                      isMine
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
                    ].join(" ")}
                  >
                    {m.body}
                  </div>
                  <div
                    className={[
                      "mt-0.5 text-[10px] text-neutral-400",
                      isMine ? "text-right" : "text-left",
                    ].join(" ")}
                  >
                    {formatTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={onSend} className="flex items-end gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="메시지 입력…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(e);
            }
          }}
          className="flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          전송
        </button>
      </form>
    </div>
  );
}

interface CreateRoomProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateRoomModal({ onClose, onCreated }: CreateRoomProps) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listProfiles()
      .then((list) => setProfiles(list.filter((p) => p.active && p.role !== "pending")))
      .catch((err) => {
        console.error(err);
        show("멤버 목록 불러오기 실패");
      });
  }, [show]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit() {
    if (!name.trim()) {
      show("방 이름을 입력하세요");
      return;
    }
    setBusy(true);
    try {
      await createChatRoom(name.trim(), "general", Array.from(selected));
      show("방 생성됨");
      onCreated();
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h3 className="text-base font-semibold">채팅방 만들기</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="방 이름"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <div>
            <div className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              초대할 멤버
            </div>
            <ul className="space-y-1">
              {profiles.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm dark:border-neutral-700">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="flex-1 truncate">{p.name || p.email}</span>
                    <span className="text-[11px] text-neutral-500">{p.role}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy ? "생성 중…" : "만들기"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
