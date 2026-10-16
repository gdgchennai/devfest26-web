"use client";
import { useEffect, useState } from "react";
import { acceptSnapshot, type HallSnapshot } from "@/lib/hall-model";
import { checkHallLiveEnabled, HALL_AVAILABILITY_EVENT } from "@/lib/hall-availability-client";
import { HALL_CONNECTION_GRACE_MS, HALL_FALLBACK_PATH } from "@/lib/hall-availability";

export function useHallLive({ publicView = false }: { publicView?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState<HallSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false,
      socket: WebSocket | null = null,
      timer: ReturnType<typeof setTimeout>,
      deadline: ReturnType<typeof setTimeout> | undefined,
      checking = false,
      attempts = 0;
    let clock: { server: number; received: number; frozen: boolean } | null =
      null;
    function fallback() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      socket?.close(1000, "Agenda fallback");
      // Full navigation bypasses prefetched Live/RSC and the motion transition cache.
      window.location.replace(HALL_FALLBACK_PATH);
    }
    function startDeadline() {
      if (publicView && deadline === undefined)
        deadline = setTimeout(fallback, HALL_CONNECTION_GRACE_MS);
    }
    function availabilityChanged() {
      if (publicView && document.documentElement.dataset.hallLiveEnabled === "false")
        fallback();
    }
    async function connect(forceCheck = false) {
      if (stopped || document.hidden || (socket && socket.readyState <= WebSocket.OPEN)) return;
      startDeadline();
      if (publicView) {
        if (checking) return;
        checking = true;
        const enabled = await checkHallLiveEnabled(forceCheck);
        checking = false;
        if (stopped || document.hidden) return;
        if (!enabled) return fallback();
      }
      const current = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/halls/socket`,
      );
      socket = current;
      current.onmessage = (event) => {
        if (stopped || socket !== current) return;
        try {
          const incoming = JSON.parse(event.data) as HallSnapshot;
          setSnapshot((previous) => {
            const next = acceptSnapshot(previous, incoming);
            if (next === incoming)
              clock = {
                server: incoming.serverNow,
                received: Date.now(),
                frozen: incoming.clock !== null,
              };
            return next;
          });
          setConnected(true);
          attempts = 0;
          clearTimeout(deadline);
          deadline = undefined;
        } catch {
          current.close(1002, "Invalid snapshot");
        }
      };
      current.onclose = () => {
        if (stopped || socket !== current) return;
        setConnected(false);
        if (!stopped && !document.hidden) {
          startDeadline();
          timer = setTimeout(
            () => void connect(),
            Math.min(30000, 500 * 2 ** Math.min(attempts++, 6)) *
              (0.75 + Math.random() / 2),
          );
        }
      };
      current.onerror = () => current.close();
    }
    function visibility() {
      clearTimeout(timer);
      if (document.hidden) {
        clearTimeout(deadline);
        deadline = undefined;
        socket?.close(1000, "Hidden");
      } else {
        // Check even if the prior socket has not reported its close yet.
        if (publicView) void checkHallLiveEnabled(true).then((enabled) => {
          if (!stopped && !document.hidden && !enabled) fallback();
        });
        void connect(true);
      }
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener(HALL_AVAILABILITY_EVENT, availabilityChanged);
    const tick = setInterval(
      () =>
        setNow(
          clock
            ? clock.server + (clock.frozen ? 0 : Date.now() - clock.received)
            : Date.now(),
        ),
      1000,
    );
    void connect(true);
    return () => {
      stopped = true;
      clearInterval(tick);
      clearTimeout(timer);
      clearTimeout(deadline);
      socket?.close(1000, "Leaving");
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener(HALL_AVAILABILITY_EVENT, availabilityChanged);
    };
  }, [publicView]);
  return { snapshot, connected, now };
}
