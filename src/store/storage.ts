import { BUILTIN_TEMPLATES } from "../data/seed";
import type { AppState, Job, Stage } from "../types";

const STORAGE_KEY_V1 = "air-defence:v1";
const STORAGE_KEY = "air-defence:v2";

interface JobV1 {
  id: string;
  customer: string;
  address: string;
  size: string;
  layout: string;
  date: string;
  staff: string;
  stages: Array<Omit<Stage, "substeps">>;
  vars: Job["vars"];
  checklist: Job["checklist"];
  createdAt: number;
}

interface AppStateV1 {
  schemaVersion: 1;
  jobs: JobV1[];
  currentJobId: string | null;
  templates: Array<{
    id: string;
    name: string;
    stages: Array<Omit<Stage, "id" | "done" | "substeps">>;
    createdAt: number;
    builtin?: boolean;
  }>;
}

function migrateV1toV2(v1: AppStateV1): AppState {
  const jobs: Job[] = v1.jobs.map((j) => ({
    ...j,
    clientStages: j.stages.map((s) => ({ ...s, substeps: [] })),
    siteStages: [],
  }));
  return {
    schemaVersion: 2,
    jobs,
    currentJobId: v1.currentJobId,
    templates: [
      ...BUILTIN_TEMPLATES,
      ...v1.templates
        .filter((t) => !t.builtin)
        .map((t) => ({
          id: t.id,
          name: t.name,
          mode: "client" as const,
          stages: t.stages.map((s) => ({ ...s, substeps: [] })),
          createdAt: t.createdAt,
        })),
    ],
  };
}

export function loadState(): AppState {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<AppState>;
      if (parsed && parsed.schemaVersion === 2) {
        const templates = parsed.templates ?? [];
        // Ensure builtin templates always present (in case user-edited storage)
        const hasClient = templates.some((t) => t.id === "builtin-client-default");
        const hasSite = templates.some((t) => t.id === "builtin-site-default");
        const merged = [
          ...(hasClient ? [] : [BUILTIN_TEMPLATES[0]]),
          ...(hasSite ? [] : [BUILTIN_TEMPLATES[1]]),
          ...templates,
        ];
        return {
          schemaVersion: 2,
          jobs: parsed.jobs ?? [],
          currentJobId: parsed.currentJobId ?? null,
          templates: merged,
        };
      }
    }
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const v1 = JSON.parse(rawV1) as AppStateV1;
      if (v1 && v1.schemaVersion === 1) {
        const next = migrateV1toV2(v1);
        saveState(next);
        return next;
      }
    }
    return initialState();
  } catch {
    return initialState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota or unavailable — silent
  }
}

export function initialState(): AppState {
  return {
    schemaVersion: 2,
    jobs: [],
    currentJobId: null,
    templates: [...BUILTIN_TEMPLATES],
  };
}
