"use client";

import { useEffect, useState } from "react";
import {
  emptyProgress,
  PROGRESS_EVENT,
  PROGRESS_UNAVAILABLE_EVENT,
  readProgress,
  type ProgressData,
} from "../lib/progress";

export type LocalProgressState =
  | { status: "loading"; data: ProgressData }
  | { status: "ready"; data: ProgressData }
  | { status: "unavailable"; data: ProgressData };

/** Keeps every progress consumer in sync with local and cross-tab updates. */
export function useLocalProgress(): LocalProgressState {
  const [state, setState] = useState<LocalProgressState>({
    status: "loading",
    data: emptyProgress(),
  });

  useEffect(() => {
    const refresh = () => {
      try {
        setState({
          status: "ready",
          data: readProgress(window.localStorage),
        });
      } catch {
        setState({ status: "unavailable", data: emptyProgress() });
      }
    };

    refresh();
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener(PROGRESS_UNAVAILABLE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener(PROGRESS_UNAVAILABLE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return state;
}
