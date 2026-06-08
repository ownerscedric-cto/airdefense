import { useCallback, useEffect, useState } from "react";
import { listEvents, listServiceTypes } from "../../lib/db/events";
import type { EventRow, ServiceType } from "../../lib/db/types";
import { supabase } from "../../lib/supabase";

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [evts, sts] = await Promise.all([listEvents(), listServiceTypes()]);
      setEvents(evts);
      setServiceTypes(sts);
      setError(null);
    } catch (err) {
      console.error("[useEvents.refresh]", err);
      setError(err instanceof Error ? err.message : "불러오기 실패");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    refresh().finally(() => {
      if (mounted) setLoading(false);
    });

    // events 테이블 변경 실시간 구독
    const ch = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_assignments" },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  return { events, serviceTypes, loading, error, refresh };
}
