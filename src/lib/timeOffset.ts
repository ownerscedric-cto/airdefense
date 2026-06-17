// 시공 시작 시각(00:00) 기준 누적 분(offsetMinutes) <-> 표시 형식 변환 헬퍼.

/** "HH:mm" 절대 시각 문자열 → 분 (예: "08:21" → 501). 빈 문자열/잘못된 값은 null. */
export function parseHHMMToMinutes(time: string): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 47 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 분 → "HH:mm" 절대 시각. 음수/잘못된 값은 빈 문자열. */
export function minutesToHHMM(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 누적 분 → "+H:MM" 표시. */
export function formatOffset(offsetMinutes: number | null | undefined): string {
  if (offsetMinutes == null || !Number.isFinite(offsetMinutes) || offsetMinutes < 0) return "";
  const h = Math.floor(offsetMinutes / 60);
  const m = offsetMinutes % 60;
  if (h === 0) return `+${m}분`;
  if (m === 0) return `+${h}시간`;
  return `+${h}:${String(m).padStart(2, "0")}`;
}

/**
 * 작업의 시공 시작 시각(startHHMM)과 stage 의 offsetMinutes 로 절대 시각을 계산.
 * startHHMM 없으면 빈 문자열.
 */
export function computeAbsolute(startHHMM: string | null | undefined, offsetMinutes: number | null | undefined): string {
  if (!startHHMM || offsetMinutes == null) return "";
  const startMin = parseHHMMToMinutes(startHHMM);
  if (startMin == null) return "";
  return minutesToHHMM(startMin + offsetMinutes);
}

/**
 * stage 의 표시 시각을 결정.
 * - offsetMinutes 가 있으면: startHHMM 있을 때 절대 시각, 없으면 +H:MM
 * - 없으면: stage.time (구버전 호환)
 */
export function displayStageTime(
  stage: { time: string; offsetMinutes?: number },
  startHHMM?: string | null
): string {
  if (stage.offsetMinutes != null) {
    if (startHHMM) {
      const abs = computeAbsolute(startHHMM, stage.offsetMinutes);
      if (abs) return abs;
    }
    return formatOffset(stage.offsetMinutes);
  }
  return stage.time || "";
}

/**
 * 기존 절대 시각 배열을 offsetMinutes 로 변환.
 * 첫 비어있지 않은 시각을 0 기준으로 잡고, 나머지는 그로부터 차이를 분으로.
 * 비어있는 시각은 null 반환 → offsetMinutes 안 채움 (수동 입력 유도).
 */
export function deriveOffsetsFromAbsolute(times: string[]): Array<number | null> {
  let base: number | null = null;
  return times.map((t) => {
    const m = parseHHMMToMinutes(t);
    if (m == null) return null;
    if (base == null) {
      base = m;
      return 0;
    }
    const diff = m - base;
    return diff >= 0 ? diff : null;
  });
}

/** 분 입력 UI 용 — 시간/분 분리. */
export function splitMinutes(total: number | null | undefined): { hours: number; minutes: number } {
  if (total == null || !Number.isFinite(total) || total < 0) return { hours: 0, minutes: 0 };
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export function combineHM(hours: number, minutes: number): number {
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
