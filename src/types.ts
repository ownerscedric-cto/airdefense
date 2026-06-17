export const CATEGORIES = [
  "준비",
  "측정",
  "열풍",
  "습식",
  "대기",
  "환기",
  "마무리",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLOR: Record<Category, string> = {
  준비: "#888780",
  측정: "#7F77DD",
  열풍: "#D85A30",
  습식: "#1D9E75",
  대기: "#BA7517",
  환기: "#378ADD",
  마무리: "#888780",
};

export interface SubStep {
  id: string;
  text: string;
  done: boolean;
  note: string;
}

export interface Stage {
  id: string;
  time: string; // "HH:mm" — 절대 시각 (구버전 호환, 빈 문자열 가능)
  /**
   * 시공 시작 후 누적 분 (선택). 신규 템플릿은 이 값을 사용.
   * 절대 시각으로 보고 싶을 땐 startTime + offsetMinutes 로 표시.
   */
  offsetMinutes?: number;
  title: string;
  detail: string;
  category: Category;
  done: boolean;
  substeps: SubStep[];
}

export type TemplateMode = "client" | "site";

export interface TimelineTemplate {
  id: string;
  name: string;
  mode: TemplateMode;
  stages: Array<
    Omit<Stage, "id" | "done" | "substeps"> & {
      substeps: Array<Omit<SubStep, "id" | "done"> & { done?: false }>;
    }
  >;
  createdAt: number;
  builtin?: boolean;
}

export interface MessageVars {
  담당자명: string;
  소요시간: string;
  측정위치: string;
  HCHO배수: string;
  TVOC수준: string;
  시공전위치: string;
  시공후위치: string;
  시공비: string;
  은행계좌: string;
  예금주: string;
  페이백: string;
}

export type VarKey = keyof MessageVars;

export interface ChecklistState {
  checks: Record<string, Record<string, boolean>>;
  rooms: string[];
  roomCells: Record<string, Record<string, string>>;
  measureRows: string[];
  measureCells: Record<
    "before" | "after",
    Record<string, Record<string, string>>
  >;
}

export interface Job {
  id: string;
  customer: string;
  address: string;
  size: string;
  layout: string;
  date: string;
  staff: string;
  clientStages: Stage[];
  siteStages: Stage[];
  vars: MessageVars;
  checklist: ChecklistState;
  messageAttachments: Record<string, string[]>;
  messageOverrides: Record<string, string>;
  createdAt: number;
}

export interface AppState {
  schemaVersion: 2;
  jobs: Job[];
  currentJobId: string | null;
  templates: TimelineTemplate[];
  defaultAttachments: Record<string, string[]>;
}

export type TabKey =
  | "events"
  | "chat"
  | "jobs"
  | "timeline"
  | "messages"
  | "checklist"
  | "assets"
  | "templates"
  | "users";
export type TimelineMode = TemplateMode;
