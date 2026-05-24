import { useState } from "react";
import { ROOM_COLUMNS } from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import type { Job } from "../../types";

interface Props {
  job: Job;
}

export function RoomTable({ job }: Props) {
  const { dispatch } = useAppStore();
  const [newRoom, setNewRoom] = useState("");

  function setCell(room: string, col: string, value: string) {
    dispatch({ type: "ROOM_CELL_SET", jobId: job.id, room, col, value });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">공간별 진행 기록표</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900/60">
            <tr>
              <th className="sticky left-0 z-10 min-w-[112px] bg-neutral-50 px-2 py-2 text-left text-xs font-medium text-neutral-500 dark:bg-neutral-900/60">
                공간
              </th>
              {ROOM_COLUMNS.map((c) => (
                <th
                  key={c}
                  className="px-2 py-2 text-left text-xs font-medium text-neutral-500"
                >
                  {c}
                </th>
              ))}
              <th className="w-10 px-2 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {job.checklist.rooms.map((room) => (
              <tr
                key={room}
                className="border-t border-neutral-100 dark:border-neutral-800"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-sm font-medium dark:bg-neutral-900"
                >
                  {room}
                </th>
                {ROOM_COLUMNS.map((c) => {
                  const v = job.checklist.roomCells[room]?.[c] ?? "";
                  return (
                    <td key={c} className="px-1 py-1">
                      <input
                        value={v}
                        onChange={(e) => setCell(room, c, e.target.value)}
                        placeholder="—"
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-neutral-200 focus:border-neutral-900 focus:bg-white focus:outline-none dark:hover:border-neutral-700 dark:focus:border-white dark:focus:bg-neutral-900"
                      />
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`"${room}" 행을 삭제할까요?`))
                        dispatch({ type: "ROOM_DELETE", jobId: job.id, name: room });
                    }}
                    aria-label={`${room} 행 삭제`}
                    className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <input
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          placeholder="공간 추가 (예: 베란다)"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (newRoom.trim()) {
                dispatch({ type: "ROOM_ADD", jobId: job.id, name: newRoom });
                setNewRoom("");
              }
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!newRoom.trim()) return;
            dispatch({ type: "ROOM_ADD", jobId: job.id, name: newRoom });
            setNewRoom("");
          }}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          추가
        </button>
      </footer>
    </section>
  );
}
