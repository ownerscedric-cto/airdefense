import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import React from "react";
import {
  BUILTIN_TEMPLATES,
  DEFAULT_CLIENT_TEMPLATE,
  DEFAULT_SITE_TEMPLATE,
  DEFAULT_VARS,
  makeEmptyChecklist,
} from "../data/seed";
import { uid } from "../lib/id";
import { loadState, saveState } from "./storage";
import type {
  AppState,
  Job,
  MessageVars,
  Stage,
  SubStep,
  TemplateMode,
  TimelineTemplate,
} from "../types";

type StageField = "clientStages" | "siteStages";

function fieldOf(mode: TemplateMode): StageField {
  return mode === "client" ? "clientStages" : "siteStages";
}

type Action =
  | { type: "REPLACE_ALL"; state: AppState }
  | {
      type: "JOB_CREATE";
      data: {
        meta: Omit<
          Job,
          | "id"
          | "clientStages"
          | "siteStages"
          | "vars"
          | "checklist"
          | "messageAttachments"
          | "messageOverrides"
          | "createdAt"
        >;
        clientTemplateId: string | null;
        siteTemplateId: string | null;
      };
    }
  | { type: "JOB_SELECT"; id: string | null }
  | { type: "JOB_DELETE"; id: string }
  | {
      type: "JOB_UPDATE_META";
      id: string;
      patch: Partial<
        Pick<
          Job,
          "customer" | "address" | "size" | "layout" | "date" | "staff"
        >
      >;
    }
  | {
      type: "STAGE_ADD";
      jobId: string;
      mode: TemplateMode;
      stage: Omit<Stage, "id">;
    }
  | {
      type: "STAGE_UPDATE";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      patch: Partial<Stage>;
    }
  | { type: "STAGE_DELETE"; jobId: string; mode: TemplateMode; stageId: string }
  | {
      type: "STAGE_MOVE";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      dir: "up" | "down";
    }
  | { type: "STAGE_TOGGLE_DONE"; jobId: string; mode: TemplateMode; stageId: string }
  | {
      type: "SUBSTEP_ADD";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      text: string;
    }
  | {
      type: "SUBSTEP_UPDATE";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      subId: string;
      patch: Partial<SubStep>;
    }
  | {
      type: "SUBSTEP_DELETE";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      subId: string;
    }
  | {
      type: "SUBSTEP_TOGGLE";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      subId: string;
    }
  | {
      type: "SUBSTEP_MOVE";
      jobId: string;
      mode: TemplateMode;
      stageId: string;
      subId: string;
      dir: "up" | "down";
    }
  | {
      type: "TEMPLATE_SAVE";
      jobId: string;
      mode: TemplateMode;
      name: string;
    }
  | { type: "TEMPLATE_DELETE"; id: string }
  | {
      type: "TEMPLATE_APPLY";
      jobId: string;
      mode: TemplateMode;
      templateId: string;
    }
  | { type: "TEMPLATE_RESET_DEFAULT"; jobId: string; mode: TemplateMode }
  | { type: "VARS_UPDATE"; jobId: string; patch: Partial<MessageVars> }
  | { type: "CHECK_TOGGLE"; jobId: string; section: string; item: string }
  | { type: "ROOM_ADD"; jobId: string; name: string }
  | { type: "ROOM_DELETE"; jobId: string; name: string }
  | { type: "ROOM_RENAME"; jobId: string; oldName: string; newName: string }
  | {
      type: "ROOM_CELL_SET";
      jobId: string;
      room: string;
      col: string;
      value: string;
    }
  | { type: "MEASURE_ROW_ADD"; jobId: string; name: string }
  | { type: "MEASURE_ROW_DELETE"; jobId: string; name: string }
  | {
      type: "MEASURE_ROW_RENAME";
      jobId: string;
      oldName: string;
      newName: string;
    }
  | {
      type: "MEASURE_CELL_SET";
      jobId: string;
      phase: "before" | "after";
      row: string;
      col: string;
      value: string;
    }
  | { type: "ATTACHMENT_ADD"; jobId: string; messageKey: string; assetId: string }
  | { type: "ATTACHMENT_REMOVE"; jobId: string; messageKey: string; assetId: string }
  | { type: "DEFAULT_ATTACHMENT_ADD"; messageKey: string; assetId: string }
  | { type: "DEFAULT_ATTACHMENT_REMOVE"; messageKey: string; assetId: string }
  | { type: "ATTACHMENT_REMAP_ID"; oldId: string; newId: string }
  | { type: "MESSAGE_OVERRIDE_SET"; jobId: string; messageKey: string; text: string }
  | { type: "MESSAGE_OVERRIDE_CLEAR"; jobId: string; messageKey: string }
  // ───── 작업 독립 — 타임라인 템플릿 자체를 자유 편집 (admin 용) ─────
  | { type: "TEMPLATE_CREATE"; name: string; mode: TemplateMode }
  | { type: "TEMPLATE_DUPLICATE"; sourceId: string; newName: string }
  | { type: "TEMPLATE_RENAME"; id: string; name: string }
  | {
      type: "TEMPLATE_STAGE_ADD";
      templateId: string;
      stage: TimelineTemplate["stages"][number];
    }
  | {
      type: "TEMPLATE_STAGE_INSERT";
      templateId: string;
      index: number; // 이 위치에 새 단계를 끼워 넣음 (0 = 맨 위)
      stage: TimelineTemplate["stages"][number];
    }
  | {
      type: "TEMPLATE_STAGE_UPDATE";
      templateId: string;
      index: number;
      patch: Partial<TimelineTemplate["stages"][number]>;
    }
  | { type: "TEMPLATE_STAGE_DELETE"; templateId: string; index: number }
  | {
      type: "TEMPLATE_STAGE_MOVE";
      templateId: string;
      index: number;
      dir: "up" | "down";
    };

function updateJob(
  state: AppState,
  jobId: string,
  fn: (j: Job) => Job
): AppState {
  return {
    ...state,
    jobs: state.jobs.map((j) => (j.id === jobId ? fn(j) : j)),
  };
}

function updateStages(
  state: AppState,
  jobId: string,
  mode: TemplateMode,
  fn: (stages: Stage[]) => Stage[]
): AppState {
  const field = fieldOf(mode);
  return updateJob(state, jobId, (j) => ({ ...j, [field]: fn(j[field]) }));
}

function updateStage(
  stages: Stage[],
  stageId: string,
  fn: (s: Stage) => Stage
): Stage[] {
  return stages.map((s) => (s.id === stageId ? fn(s) : s));
}

function stagesFromTemplate(tpl: TimelineTemplate): Stage[] {
  return tpl.stages.map((s) => ({
    ...s,
    id: uid("st"),
    done: false,
    substeps: (s.substeps ?? []).map((sub) => ({
      ...sub,
      id: uid("sub"),
      done: false,
      note: sub.note ?? "",
    })),
  }));
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "REPLACE_ALL":
      return action.state;

    case "JOB_CREATE": {
      const clientTpl =
        state.templates.find(
          (t) => t.mode === "client" && t.id === action.data.clientTemplateId
        ) ?? DEFAULT_CLIENT_TEMPLATE;
      const siteTpl =
        state.templates.find(
          (t) => t.mode === "site" && t.id === action.data.siteTemplateId
        ) ?? DEFAULT_SITE_TEMPLATE;
      const seededAttachments: Record<string, string[]> = {};
      for (const [k, ids] of Object.entries(state.defaultAttachments ?? {})) {
        if (ids.length > 0) seededAttachments[k] = [...ids];
      }
      const job: Job = {
        id: uid("job"),
        ...action.data.meta,
        clientStages: stagesFromTemplate(clientTpl),
        siteStages: stagesFromTemplate(siteTpl),
        vars: { ...DEFAULT_VARS, 담당자명: action.data.meta.staff || "" },
        checklist: makeEmptyChecklist(),
        messageAttachments: seededAttachments,
        messageOverrides: {},
        createdAt: Date.now(),
      };
      return { ...state, jobs: [job, ...state.jobs], currentJobId: job.id };
    }

    case "JOB_SELECT":
      return { ...state, currentJobId: action.id };

    case "JOB_DELETE": {
      const jobs = state.jobs.filter((j) => j.id !== action.id);
      const currentJobId =
        state.currentJobId === action.id
          ? jobs[0]?.id ?? null
          : state.currentJobId;
      return { ...state, jobs, currentJobId };
    }

    case "JOB_UPDATE_META":
      return updateJob(state, action.id, (j) => ({ ...j, ...action.patch }));

    case "STAGE_ADD":
      return updateStages(state, action.jobId, action.mode, (stages) => [
        ...stages,
        { ...action.stage, id: uid("st") },
      ]);

    case "STAGE_UPDATE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => ({ ...s, ...action.patch }))
      );

    case "STAGE_DELETE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        stages.filter((s) => s.id !== action.stageId)
      );

    case "STAGE_MOVE":
      return updateStages(state, action.jobId, action.mode, (stages) => {
        const idx = stages.findIndex((s) => s.id === action.stageId);
        if (idx < 0) return stages;
        const target = action.dir === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= stages.length) return stages;
        const next = stages.slice();
        const [moved] = next.splice(idx, 1);
        next.splice(target, 0, moved);
        return next;
      });

    case "STAGE_TOGGLE_DONE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => ({ ...s, done: !s.done }))
      );

    case "SUBSTEP_ADD":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => ({
          ...s,
          substeps: [
            ...s.substeps,
            {
              id: uid("sub"),
              text: action.text.trim() || "(이름 없음)",
              done: false,
              note: "",
            },
          ],
        }))
      );

    case "SUBSTEP_UPDATE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => ({
          ...s,
          substeps: s.substeps.map((sub) =>
            sub.id === action.subId ? { ...sub, ...action.patch } : sub
          ),
        }))
      );

    case "SUBSTEP_DELETE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => ({
          ...s,
          substeps: s.substeps.filter((sub) => sub.id !== action.subId),
        }))
      );

    case "SUBSTEP_TOGGLE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => ({
          ...s,
          substeps: s.substeps.map((sub) =>
            sub.id === action.subId ? { ...sub, done: !sub.done } : sub
          ),
        }))
      );

    case "SUBSTEP_MOVE":
      return updateStages(state, action.jobId, action.mode, (stages) =>
        updateStage(stages, action.stageId, (s) => {
          const idx = s.substeps.findIndex((sub) => sub.id === action.subId);
          if (idx < 0) return s;
          const target = action.dir === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= s.substeps.length) return s;
          const next = s.substeps.slice();
          const [moved] = next.splice(idx, 1);
          next.splice(target, 0, moved);
          return { ...s, substeps: next };
        })
      );

    case "TEMPLATE_SAVE": {
      const job = state.jobs.find((j) => j.id === action.jobId);
      if (!job) return state;
      const stages = action.mode === "client" ? job.clientStages : job.siteStages;
      const tpl: TimelineTemplate = {
        id: uid("tpl"),
        name: action.name.trim() || "이름 없음",
        mode: action.mode,
        stages: stages.map(({ id, done, substeps, ...rest }) => ({
          ...rest,
          substeps: substeps.map(({ id: _i, done: _d, ...sr }) => sr),
        })),
        createdAt: Date.now(),
      };
      return { ...state, templates: [...state.templates, tpl] };
    }

    case "TEMPLATE_DELETE":
      return {
        ...state,
        templates: state.templates.filter(
          (t) => t.builtin || t.id !== action.id
        ),
      };

    case "TEMPLATE_APPLY": {
      const tpl = state.templates.find(
        (t) => t.id === action.templateId && t.mode === action.mode
      );
      if (!tpl) return state;
      return updateStages(state, action.jobId, action.mode, () =>
        stagesFromTemplate(tpl)
      );
    }

    case "TEMPLATE_RESET_DEFAULT": {
      const tpl =
        action.mode === "client" ? DEFAULT_CLIENT_TEMPLATE : DEFAULT_SITE_TEMPLATE;
      return updateStages(state, action.jobId, action.mode, () =>
        stagesFromTemplate(tpl)
      );
    }

    case "VARS_UPDATE":
      return updateJob(state, action.jobId, (j) => ({
        ...j,
        vars: { ...j.vars, ...action.patch },
      }));

    case "CHECK_TOGGLE":
      return updateJob(state, action.jobId, (j) => {
        const sec = j.checklist.checks[action.section] ?? {};
        const cur = !!sec[action.item];
        return {
          ...j,
          checklist: {
            ...j.checklist,
            checks: {
              ...j.checklist.checks,
              [action.section]: { ...sec, [action.item]: !cur },
            },
          },
        };
      });

    case "ROOM_ADD":
      return updateJob(state, action.jobId, (j) => {
        const name = action.name.trim();
        if (!name || j.checklist.rooms.includes(name)) return j;
        return {
          ...j,
          checklist: { ...j.checklist, rooms: [...j.checklist.rooms, name] },
        };
      });

    case "ROOM_DELETE":
      return updateJob(state, action.jobId, (j) => {
        const { [action.name]: _, ...rest } = j.checklist.roomCells;
        return {
          ...j,
          checklist: {
            ...j.checklist,
            rooms: j.checklist.rooms.filter((r) => r !== action.name),
            roomCells: rest,
          },
        };
      });

    case "ROOM_RENAME":
      return updateJob(state, action.jobId, (j) => {
        const oldName = action.oldName;
        const newName = action.newName.trim();
        if (!newName || oldName === newName) return j;
        if (j.checklist.rooms.includes(newName)) return j;
        const cells = { ...j.checklist.roomCells };
        if (cells[oldName]) {
          cells[newName] = cells[oldName];
          delete cells[oldName];
        }
        return {
          ...j,
          checklist: {
            ...j.checklist,
            rooms: j.checklist.rooms.map((r) => (r === oldName ? newName : r)),
            roomCells: cells,
          },
        };
      });

    case "ROOM_CELL_SET":
      return updateJob(state, action.jobId, (j) => {
        const row = j.checklist.roomCells[action.room] ?? {};
        return {
          ...j,
          checklist: {
            ...j.checklist,
            roomCells: {
              ...j.checklist.roomCells,
              [action.room]: { ...row, [action.col]: action.value },
            },
          },
        };
      });

    case "MEASURE_ROW_ADD":
      return updateJob(state, action.jobId, (j) => {
        const name = action.name.trim();
        if (!name || j.checklist.measureRows.includes(name)) return j;
        return {
          ...j,
          checklist: {
            ...j.checklist,
            measureRows: [...j.checklist.measureRows, name],
          },
        };
      });

    case "MEASURE_ROW_DELETE":
      return updateJob(state, action.jobId, (j) => {
        const before = { ...j.checklist.measureCells.before };
        const after = { ...j.checklist.measureCells.after };
        delete before[action.name];
        delete after[action.name];
        return {
          ...j,
          checklist: {
            ...j.checklist,
            measureRows: j.checklist.measureRows.filter(
              (r) => r !== action.name
            ),
            measureCells: { before, after },
          },
        };
      });

    case "MEASURE_ROW_RENAME":
      return updateJob(state, action.jobId, (j) => {
        const oldName = action.oldName;
        const newName = action.newName.trim();
        if (!newName || oldName === newName) return j;
        if (j.checklist.measureRows.includes(newName)) return j;
        const before = { ...j.checklist.measureCells.before };
        const after = { ...j.checklist.measureCells.after };
        if (before[oldName]) {
          before[newName] = before[oldName];
          delete before[oldName];
        }
        if (after[oldName]) {
          after[newName] = after[oldName];
          delete after[oldName];
        }
        return {
          ...j,
          checklist: {
            ...j.checklist,
            measureRows: j.checklist.measureRows.map((r) =>
              r === oldName ? newName : r
            ),
            measureCells: { before, after },
          },
        };
      });

    case "MEASURE_CELL_SET":
      return updateJob(state, action.jobId, (j) => {
        const phase = action.phase;
        const phaseObj = { ...j.checklist.measureCells[phase] };
        const row = { ...(phaseObj[action.row] ?? {}) };
        row[action.col] = action.value;
        phaseObj[action.row] = row;
        return {
          ...j,
          checklist: {
            ...j.checklist,
            measureCells: { ...j.checklist.measureCells, [phase]: phaseObj },
          },
        };
      });

    case "ATTACHMENT_ADD":
      return updateJob(state, action.jobId, (j) => {
        const cur = j.messageAttachments[action.messageKey] ?? [];
        if (cur.includes(action.assetId)) return j;
        return {
          ...j,
          messageAttachments: {
            ...j.messageAttachments,
            [action.messageKey]: [...cur, action.assetId],
          },
        };
      });

    case "ATTACHMENT_REMOVE":
      return updateJob(state, action.jobId, (j) => {
        const cur = j.messageAttachments[action.messageKey] ?? [];
        const next = cur.filter((id) => id !== action.assetId);
        const map = { ...j.messageAttachments };
        if (next.length === 0) delete map[action.messageKey];
        else map[action.messageKey] = next;
        return { ...j, messageAttachments: map };
      });

    case "DEFAULT_ATTACHMENT_ADD": {
      const cur = state.defaultAttachments[action.messageKey] ?? [];
      if (cur.includes(action.assetId)) return state;
      return {
        ...state,
        defaultAttachments: {
          ...state.defaultAttachments,
          [action.messageKey]: [...cur, action.assetId],
        },
      };
    }

    case "DEFAULT_ATTACHMENT_REMOVE": {
      const cur = state.defaultAttachments[action.messageKey] ?? [];
      const next = cur.filter((id) => id !== action.assetId);
      const map = { ...state.defaultAttachments };
      if (next.length === 0) delete map[action.messageKey];
      else map[action.messageKey] = next;
      return { ...state, defaultAttachments: map };
    }

    case "ATTACHMENT_REMAP_ID": {
      // 모든 작업의 messageAttachments + 전역 defaultAttachments 에서 oldId 를 newId 로 치환
      const remapList = (arr: string[]) =>
        arr.map((id) => (id === action.oldId ? action.newId : id));
      const remapMap = (m: Record<string, string[]>) => {
        const out: Record<string, string[]> = {};
        for (const k of Object.keys(m)) out[k] = remapList(m[k]);
        return out;
      };
      return {
        ...state,
        jobs: state.jobs.map((j) => ({
          ...j,
          messageAttachments: remapMap(j.messageAttachments ?? {}),
        })),
        defaultAttachments: remapMap(state.defaultAttachments ?? {}),
      };
    }

    case "MESSAGE_OVERRIDE_SET":
      return updateJob(state, action.jobId, (j) => ({
        ...j,
        messageOverrides: {
          ...j.messageOverrides,
          [action.messageKey]: action.text,
        },
      }));

    case "MESSAGE_OVERRIDE_CLEAR":
      return updateJob(state, action.jobId, (j) => {
        const map = { ...j.messageOverrides };
        delete map[action.messageKey];
        return { ...j, messageOverrides: map };
      });

    case "TEMPLATE_CREATE": {
      const tpl: TimelineTemplate = {
        id: uid("tpl"),
        name: action.name.trim() || "이름 없음",
        mode: action.mode,
        stages: [],
        createdAt: Date.now(),
      };
      return { ...state, templates: [...state.templates, tpl] };
    }

    case "TEMPLATE_DUPLICATE": {
      const src = state.templates.find((t) => t.id === action.sourceId);
      if (!src) return state;
      const tpl: TimelineTemplate = {
        id: uid("tpl"),
        name: action.newName.trim() || `${src.name} (복제)`,
        mode: src.mode,
        // builtin 표시는 떼고, stages 는 깊은 복사
        stages: src.stages.map((s) => ({
          ...s,
          substeps: (s.substeps ?? []).map((sub) => ({ ...sub })),
        })),
        createdAt: Date.now(),
      };
      return { ...state, templates: [...state.templates, tpl] };
    }

    case "TEMPLATE_RENAME":
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.id && !t.builtin
            ? { ...t, name: action.name.trim() || t.name }
            : t
        ),
      };

    case "TEMPLATE_STAGE_ADD":
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId && !t.builtin
            ? { ...t, stages: [...t.stages, action.stage] }
            : t
        ),
      };

    case "TEMPLATE_STAGE_INSERT":
      return {
        ...state,
        templates: state.templates.map((t) => {
          if (t.id !== action.templateId || t.builtin) return t;
          const clamped = Math.max(0, Math.min(action.index, t.stages.length));
          const next = t.stages.slice();
          next.splice(clamped, 0, action.stage);
          return { ...t, stages: next };
        }),
      };

    case "TEMPLATE_STAGE_UPDATE":
      return {
        ...state,
        templates: state.templates.map((t) => {
          if (t.id !== action.templateId || t.builtin) return t;
          const next = t.stages.slice();
          if (action.index < 0 || action.index >= next.length) return t;
          next[action.index] = { ...next[action.index], ...action.patch };
          return { ...t, stages: next };
        }),
      };

    case "TEMPLATE_STAGE_DELETE":
      return {
        ...state,
        templates: state.templates.map((t) => {
          if (t.id !== action.templateId || t.builtin) return t;
          if (action.index < 0 || action.index >= t.stages.length) return t;
          return {
            ...t,
            stages: t.stages.filter((_, i) => i !== action.index),
          };
        }),
      };

    case "TEMPLATE_STAGE_MOVE":
      return {
        ...state,
        templates: state.templates.map((t) => {
          if (t.id !== action.templateId || t.builtin) return t;
          const next = t.stages.slice();
          const i = action.index;
          const j = action.dir === "up" ? i - 1 : i + 1;
          if (i < 0 || i >= next.length || j < 0 || j >= next.length) return t;
          [next[i], next[j]] = [next[j], next[i]];
          return { ...t, stages: next };
        }),
      };

    default:
      return state;
  }
}

interface StoreCtx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  currentJob: Job | null;
}

const Ctx = createContext<StoreCtx | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentJob = useMemo(
    () => state.jobs.find((j) => j.id === state.currentJobId) ?? null,
    [state.jobs, state.currentJobId]
  );

  const value = useMemo(
    () => ({ state, dispatch, currentJob }),
    [state, currentJob]
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useAppStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppStoreProvider missing");
  return v;
}

export function useCurrentJob(): Job | null {
  return useAppStore().currentJob;
}

export function useReplaceAll() {
  const { dispatch } = useAppStore();
  return useCallback(
    (next: AppState) => dispatch({ type: "REPLACE_ALL", state: next }),
    [dispatch]
  );
}

export { BUILTIN_TEMPLATES };
export type { Action };
