// Supabase Edge Function — 구글 시트 → events 단방향 동기화
//
// 흐름:
//   1) app_settings.sheet_sync 에서 spreadsheet_id / sheet_name / column_map / service_map 조회
//   2) 서비스 계정 JWT 로 Sheets API 호출
//   3) 헤더 행 + 데이터 행 파싱
//   4) 각 행에 "시스템 ID" 가 없으면 생성해서 시트에 다시 써넣음 (앱이 부여)
//   5) fn_upsert_event_from_sheet 로 events 에 upsert (INSERT 시 배분 트리거 자동 실행)
//   6) 시트에서 사라진 행은 fn_cancel_missing_sheet_events 로 cancel
//   7) fn_record_sheet_sync 로 결과 기록
//
// 환경변수 (Supabase Functions secrets):
//   SUPABASE_URL                : 자동 주입
//   SUPABASE_SERVICE_ROLE_KEY   : 자동 주입
//   GOOGLE_SERVICE_ACCOUNT_JSON : 서비스 계정 JSON 전체 (한 줄 stringify)
//
// 실행:
//   - 수동: curl 로 POST 호출 (테스트용)
//   - 자동: Supabase Cron 으로 5분마다 호출 (가이드는 supabase/functions/CRON.md 참고)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ===== 타입 =====
interface SheetSyncConfig {
  enabled: boolean;
  spreadsheet_id: string;
  sheet_name: string;
  header_row: number;       // 1-based
  first_data_row: number;   // 1-based
  column_map: Record<string, string>;     // 내부 키 → 시트 헤더명
  service_map: Record<string, string>;    // 시트 한글 라벨 → service_type 코드
}

interface ParsedRow {
  rowNumber: number;           // 시트의 행 번호 (1-based, 헤더 포함)
  sheetRowId: string;          // 시스템 ID (앱이 부여)
  serviceType: string;
  title: string;
  startsAt: string;            // ISO
  endsAt: string | null;
  customer: string | null;
  address: string | null;
  size: string | null;
  layout: string | null;
  notes: string | null;
  raw: Record<string, string>;
}

// ===== 메인 핸들러 =====
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // 1) 설정 조회
    const { data: settingRow, error: settingErr } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sheet_sync")
      .single();
    if (settingErr) throw new Error(`설정 조회 실패: ${settingErr.message}`);
    const config = settingRow!.value as SheetSyncConfig;

    if (!config.enabled) {
      return jsonResponse({ skipped: "sheet_sync disabled" });
    }
    if (!config.spreadsheet_id) {
      throw new Error("spreadsheet_id 가 비어 있습니다");
    }

    // 2) 서비스 계정 토큰 획득
    const accessToken = await getServiceAccountAccessToken(
      [
        "https://www.googleapis.com/auth/spreadsheets",
      ]
    );

    // 3) 시트 데이터 조회
    const range = `${config.sheet_name}`;
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!sheetRes.ok) {
      const t = await sheetRes.text();
      throw new Error(`시트 읽기 실패 (${sheetRes.status}): ${t}`);
    }
    const sheetJson = await sheetRes.json();
    const values: string[][] = sheetJson.values ?? [];
    if (values.length === 0) {
      await recordSync(supabase, "success", null);
      return jsonResponse({ message: "시트 비어있음", upserted: 0 });
    }

    // 4) 헤더 파싱
    const headerRowIndex = config.header_row - 1;
    const firstDataIndex = config.first_data_row - 1;
    const headers = values[headerRowIndex] ?? [];
    if (headers.length === 0) throw new Error("헤더 행 없음");

    const idx = (key: string): number => {
      const headerName = config.column_map[key];
      if (!headerName) return -1;
      return headers.findIndex((h) => h?.trim() === headerName.trim());
    };

    const colDate = idx("date");
    const colTime = idx("time");
    const colService = idx("service_type");
    const colCustomer = idx("customer");
    const colAddress = idx("address");
    const colSize = idx("size");
    const colLayout = idx("layout");
    const colNotes = idx("notes");
    const colRowId = idx("sheet_row_id");

    if (colDate < 0 || colService < 0) {
      throw new Error("필수 컬럼이 시트에서 안 보임 (date / service_type)");
    }

    // 5) 데이터 행 파싱 + 새 ID 부여 큐
    const parsed: ParsedRow[] = [];
    const idAssignments: Array<{ rowNumber: number; value: string }> = [];

    for (let i = firstDataIndex; i < values.length; i++) {
      const row = values[i];
      if (!row || row.length === 0) continue;

      const dateStr = (row[colDate] ?? "").trim();
      if (!dateStr) continue;  // 빈 행 스킵
      const timeStr = colTime >= 0 ? (row[colTime] ?? "").trim() : "00:00";
      const serviceStr = (row[colService] ?? "").trim();

      // 서비스 타입 매핑
      const serviceCode = config.service_map[serviceStr] ?? serviceStr;

      // 시스템 ID 확인 또는 생성
      let sheetRowId = colRowId >= 0 ? (row[colRowId] ?? "").trim() : "";
      if (!sheetRowId) {
        sheetRowId = crypto.randomUUID();
        if (colRowId >= 0) {
          idAssignments.push({ rowNumber: i + 1, value: sheetRowId });
        }
      }

      // 시작 시각 ISO 변환
      const startsAt = toISOFromKR(dateStr, timeStr);
      if (!startsAt) {
        console.warn(`[sync] 행 ${i + 1} 시각 파싱 실패: ${dateStr} ${timeStr}`);
        continue;
      }

      const customer = colCustomer >= 0 ? row[colCustomer]?.trim() || null : null;
      const address = colAddress >= 0 ? row[colAddress]?.trim() || null : null;
      const size = colSize >= 0 ? row[colSize]?.trim() || null : null;
      const layout = colLayout >= 0 ? row[colLayout]?.trim() || null : null;
      const notes = colNotes >= 0 ? row[colNotes]?.trim() || null : null;

      const title = [customer, size].filter(Boolean).join(" ") || address || `${dateStr} 일정`;

      // 원본 row 데이터 (디버깅용)
      const raw: Record<string, string> = {};
      headers.forEach((h, ci) => {
        if (h) raw[h] = row[ci] ?? "";
      });

      parsed.push({
        rowNumber: i + 1,
        sheetRowId,
        serviceType: serviceCode,
        title,
        startsAt,
        endsAt: null,
        customer,
        address,
        size,
        layout,
        notes,
        raw,
      });
    }

    // 6) 새 ID 시트에 다시 써넣기 (배치)
    if (idAssignments.length > 0 && colRowId >= 0) {
      const colLetter = columnNumberToLetter(colRowId + 1);
      const data = idAssignments.map(({ rowNumber, value }) => ({
        range: `${config.sheet_name}!${colLetter}${rowNumber}`,
        values: [[value]],
      }));
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data,
          }),
        }
      );
      if (!writeRes.ok) {
        const t = await writeRes.text();
        console.error(`[sync] 시스템 ID 쓰기 실패: ${t}`);
      }
    }

    // 7) events 에 upsert
    const sheetSource = `${config.spreadsheet_id}:${config.sheet_name}`;
    let upserted = 0;
    const errors: string[] = [];

    for (const p of parsed) {
      const { error } = await supabase.rpc("fn_upsert_event_from_sheet", {
        p_row_id: p.sheetRowId,
        p_service_type: p.serviceType,
        p_title: p.title,
        p_starts_at: p.startsAt,
        p_ends_at: p.endsAt,
        p_customer: p.customer,
        p_address: p.address,
        p_size: p.size,
        p_layout: p.layout,
        p_notes: p.notes,
        p_sheet_source: sheetSource,
        p_raw: p.raw,
      });
      if (error) {
        console.error(`[sync] upsert 실패 row=${p.rowNumber}`, error);
        errors.push(`row ${p.rowNumber}: ${error.message}`);
      } else {
        upserted++;
      }
    }

    // 8) 시트에서 사라진 행 cancel
    const presentIds = parsed.map((p) => p.sheetRowId);
    const { data: cancelledCount, error: cancelErr } = await supabase.rpc(
      "fn_cancel_missing_sheet_events",
      {
        p_present_row_ids: presentIds,
        p_sheet_source: sheetSource,
      }
    );
    if (cancelErr) {
      console.error("[sync] cancel 실패", cancelErr);
      errors.push(`cancel: ${cancelErr.message}`);
    }

    // 9) 결과 기록
    const finalStatus = errors.length > 0 ? "partial" : "success";
    await recordSync(supabase, finalStatus, errors.length > 0 ? errors.join("\n") : null);

    return jsonResponse({
      status: finalStatus,
      upserted,
      cancelled: cancelledCount ?? 0,
      errors,
    });
  } catch (err) {
    console.error("[sync] fatal", err);
    await recordSync(supabase, "error", err instanceof Error ? err.message : String(err));
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});

// ===== 헬퍼 =====

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function recordSync(
  supabase: ReturnType<typeof createClient>,
  status: string,
  error: string | null
): Promise<void> {
  await supabase.rpc("fn_record_sheet_sync", { p_status: status, p_error: error });
}

/**
 * "YYYY-MM-DD" + "HH:mm" → KST(UTC+9) 기준 ISO 문자열.
 * 시트에 입력된 시각은 한국 현장 기준이라고 가정.
 */
function toISOFromKR(dateStr: string, timeStr: string): string | null {
  const date = normalizeDate(dateStr);
  if (!date) return null;
  const time = normalizeTime(timeStr);
  if (!time) return null;
  // KST = UTC+9, ISO 표기로 직접 합성
  return `${date}T${time}:00+09:00`;
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  // "YYYY-MM-DD" 또는 "YYYY/MM/DD" 또는 "2026. 6. 20." 같은 한국 표기
  const m1 = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/);
  if (m1) {
    const [, y, mo, d] = m1;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function normalizeTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "09:00";
  // "9", "9:00", "09:00", "오전 9시" 등 간단한 형태 처리
  const m1 = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m1) {
    return `${m1[1].padStart(2, "0")}:${m1[2].padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{1,2})$/);
  if (m2) {
    return `${m2[1].padStart(2, "0")}:00`;
  }
  const m3 = s.match(/^(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?$/);
  if (m3) {
    let h = parseInt(m3[2], 10);
    const min = m3[3] ? parseInt(m3[3], 10) : 0;
    if (m3[1] === "오후" && h < 12) h += 12;
    if (m3[1] === "오전" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return null;
}

function columnNumberToLetter(n: number): string {
  // 1 → "A", 27 → "AA"
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ===== 서비스 계정 OAuth (JWT → access_token) =====
async function getServiceAccountAccessToken(scopes: string[]): Promise<string> {
  const credRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!credRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 없습니다");
  const cred = JSON.parse(credRaw) as {
    client_email: string;
    private_key: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: cred.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc(header)}.${enc(claim)}`;

  const key = await importPrivateKey(cred.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`서비스 계정 토큰 발급 실패: ${t}`);
  }
  const tok = await tokenRes.json();
  return tok.access_token as string;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
