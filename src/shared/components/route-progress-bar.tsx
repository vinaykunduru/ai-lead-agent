"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START_DELAY_MS = 100; // avoid flashing on sub-150ms navigations
const TRICKLE_INTERVAL_MS = 200;
const STUCK_TIMEOUT_MS = 8000; // safety net: same-URL clicks or a failed navigation never change pathname/searchParams

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const runningRef = useRef(false);

  // Single effect: the click listener needs to call `finish()` when a
  // navigation is detected via a pathname/searchParams change, and re-runs
  // whenever those change so it always closes over the current "finish".
  useEffect(() => {
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let trickleTimer: ReturnType<typeof setInterval> | null = null;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;

    function clearTimers() {
      if (startTimer) {
        clearTimeout(startTimer);
        startTimer = null;
      }
      if (trickleTimer) {
        clearInterval(trickleTimer);
        trickleTimer = null;
      }
      if (stuckTimer) {
        clearTimeout(stuckTimer);
        stuckTimer = null;
      }
    }

    function finish() {
      if (!runningRef.current) return;
      runningRef.current = false;
      clearTimers();
      setVisible((wasVisible) => {
        if (!wasVisible) return false;
        setProgress(100);
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 200);
        return wasVisible;
      });
    }

    function isInternalNavigation(anchor: HTMLAnchorElement) {
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return false;
      if (/^([a-z][a-z0-9+.-]*:)/i.test(href) && !href.startsWith(window.location.origin)) return false;
      return true;
    }

    function start() {
      if (runningRef.current) return;
      runningRef.current = true;
      startTimer = setTimeout(() => {
        setVisible(true);
        setProgress(12);
        trickleTimer = setInterval(() => {
          setProgress((p) => (p < 88 ? p + (88 - p) * 0.12 : p));
        }, TRICKLE_INTERVAL_MS);
      }, START_DELAY_MS);
      stuckTimer = setTimeout(finish, STUCK_TIMEOUT_MS);
    }

    function handleClick(event: MouseEvent) {
      // Note: next/link's own onClick calls preventDefault() as part of doing
      // a client-side transition, and (via React's event delegation on the
      // root container) that runs before this native document-level bubble
      // listener — so event.defaultPrevented is already true for the exact
      // clicks we care about. Don't gate on it.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !isInternalNavigation(anchor)) return;
      start();
    }

    document.addEventListener("click", handleClick);
    // pathname/searchParams changing means the navigation this effect's
    // previous run may have started has now completed.
    finish();

    return () => {
      document.removeEventListener("click", handleClick);
      clearTimers();
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5" aria-hidden="true">
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function RouteProgressBar() {
  return <ProgressBarInner />;
}
