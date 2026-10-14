"use client";
import { useEffect, useState } from "react";
import { acceptSnapshot, type HallSnapshot } from "@/lib/hall-model";

export function useHallLive() {
  const [snapshot, setSnapshot] = useState<HallSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false,
      socket: WebSocket | null = null,
      timer: ReturnType<typeof setTimeout>,
      attempts = 0;
    let clock: { server: number; received: number; frozen: boolean } | null =
      null;
    function connect() {
      if (stopped || document.hidden || (socket && socket.readyState <= WebSocket.OPEN)) return;
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
        } catch {
          current.close(1002, "Invalid snapshot");
        }
      };
      current.onclose = () => {
        if (stopped || socket !== current) return;
        setConnected(false);
        if (!stopped && !document.hidden)
          timer = setTimeout(
            connect,
            Math.min(30000, 500 * 2 ** Math.min(attempts++, 6)) *
              (0.75 + Math.random() / 2),
          );
      };
      current.onerror = () => current.close();
    }
    function visibility() {
      clearTimeout(timer);
      if (document.hidden) socket?.close(1000, "Hidden");
      else connect();
    }
    document.addEventListener("visibilitychange", visibility);
    const tick = setInterval(
      () =>
        setNow(
          clock
            ? clock.server + (clock.frozen ? 0 : Date.now() - clock.received)
            : Date.now(),
        ),
      1000,
    );
    connect();
    return () => {
      stopped = true;
      clearInterval(tick);
      clearTimeout(timer);
      socket?.close(1000, "Leaving");
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return { snapshot, connected, now };
}
