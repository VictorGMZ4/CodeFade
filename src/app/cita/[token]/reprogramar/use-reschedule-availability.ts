"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { fetchRescheduleDays, fetchRescheduleSlots } from "../actions";

type Availability = { days: string[] | null; day: string | null; month: string | null; slots: string[] | null; start: string | null; error: string };
const empty: Availability = { days: null, day: null, month: null, slots: null, start: null, error: "" };
const loadError = "No se pudieron cargar los horarios. Inténtalo de nuevo.";

export function useRescheduleAvailability(token: string, currentBarberId: string) {
  const [barberId, setBarberId] = useState(currentBarberId);
  const [state, set] = useState(empty);
  const [pending, transition] = useTransition();
  const daysRequest = useRef(0), slotsRequest = useRef(0);
  const patch = (data: Partial<Availability>) => set(previous => ({ ...previous, ...data }));
  function loadDays(id: string) {
    const request = ++daysRequest.current, slotsVersion = ++slotsRequest.current;
    setBarberId(id); set(empty);
    transition(async () => {
      try {
        const open = await fetchRescheduleDays(token, id || null);
        if (request !== daysRequest.current) return;
        patch({ days: open.days });
        if (slotsVersion === slotsRequest.current) {
          slotsRequest.current++;
          const first = open.days[0] ?? null;
          patch({ day: first, month: first?.slice(0, 7) ?? null, slots: open.firstSlots, start: null });
        }
      } catch { if (request === daysRequest.current) patch({ error: loadError }); }
    });
  }
  function loadSlots(day: string) {
    const request = ++slotsRequest.current;
    patch({ day, slots: null, start: null, error: "" });
    transition(async () => {
      try {
        const slots = await fetchRescheduleSlots(token, barberId || null, day);
        if (request === slotsRequest.current) patch({ slots });
      } catch { if (request === slotsRequest.current) patch({ error: loadError }); }
    });
  }
  useEffect(() => {
    transition(() => loadDays(currentBarberId));
    const days = daysRequest, slots = slotsRequest;
    return () => { days.current++; slots.current++; };
    // La selección inicial solo se carga al montar; los cambios usan loadDays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ...state, barberId, pending, loadDays, loadSlots, patch };
}
