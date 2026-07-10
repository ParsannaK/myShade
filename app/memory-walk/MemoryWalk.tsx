"use client";

import {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MemoryWalkController, MemoryWalkMemory } from "./types";

type MemoryWalkProps = {
  memories: MemoryWalkMemory[];
  onOpenMemory: (memoryId: string) => void;
  onProgressChange: (progress: number) => void;
  paused: boolean;
  reducedMotion: boolean;
};

function getTimeLabel(progress: number) {
  if (progress < 0.32) {
    return "Golden hour";
  }

  if (progress < 0.68) {
    return "Blue hour";
  }

  return "Under every sky";
}

export default function MemoryWalk({
  memories,
  onOpenMemory,
  onProgressChange,
  paused,
  reducedMotion,
}: MemoryWalkProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MemoryWalkController | null>(null);
  const openMemoryRef = useRef(onOpenMemory);
  const progressChangeRef = useRef(onProgressChange);
  const reducedMotionRef = useRef(reducedMotion);
  const pausedRef = useRef(paused);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [nearestMemoryId, setNearestMemoryId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const nearestMemory = useMemo(
    () => memories.find((memory) => memory.id === nearestMemoryId) ?? null,
    [memories, nearestMemoryId],
  );

  useEffect(() => {
    openMemoryRef.current = onOpenMemory;
  }, [onOpenMemory]);

  useEffect(() => {
    progressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || shouldLoad) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "520px 0px" },
    );

    observer.observe(shell);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || !shouldLoad) {
      return;
    }

    let cancelled = false;

    import("./createMemoryWalkGame").then(({ createMemoryWalkGame }) => {
      if (cancelled || !canvasHostRef.current) {
        return;
      }

      const controller = createMemoryWalkGame({
        parent: canvasHostRef.current,
        memories,
        reducedMotion: reducedMotionRef.current,
        callbacks: {
          onNearestMemoryChange: setNearestMemoryId,
          onOpenMemory: (memoryId) => openMemoryRef.current(memoryId),
          onProgressChange: (nextProgress) => {
            setProgress(nextProgress);
            progressChangeRef.current(nextProgress);
          },
          onReady: () => setIsReady(true),
          onWalkingChange: setIsWalking,
        },
      });
      controller.setPaused(pausedRef.current);
      controllerRef.current = controller;
    });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [memories, shouldLoad]);

  useEffect(() => {
    pausedRef.current = paused;
    controllerRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    controllerRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (paused) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      controllerRef.current?.move(-1);
    }

    if (key === "arrowright" || key === "d") {
      event.preventDefault();
      controllerRef.current?.move(1);
    }

    if (key === "enter" && nearestMemory) {
      event.preventDefault();
      controllerRef.current?.interact();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
      controllerRef.current?.move(0);
    }
  }

  function startDirectionalWalk(
    event: ReactPointerEvent<HTMLButtonElement>,
    direction: -1 | 1,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    controllerRef.current?.move(direction);
  }

  function stopDirectionalWalk(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    controllerRef.current?.move(0);
  }

  return (
    <div
      className={`memory-walk-shell ${isWalking ? "is-walking" : ""}`}
      ref={shellRef}
      role="application"
      aria-label="Shadé's memory walk through the park"
      tabIndex={0}
      onBlur={() => controllerRef.current?.move(0)}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerDown={() => shellRef.current?.focus({ preventScroll: true })}
    >
      <div className="memory-walk-hud" aria-live="polite">
        <div>
          <span className="memory-walk-kicker">The sky is changing</span>
          <strong>{getTimeLabel(progress)}</strong>
        </div>
        <div
          className="memory-walk-progress"
          role="progressbar"
          aria-label="Progress through the memory path"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ width: `${Math.max(3, progress * 100)}%` }} />
        </div>
      </div>

      <div className="memory-walk-canvas" ref={canvasHostRef} aria-hidden="true" />

      {!isReady ? (
        <div className="memory-walk-loading" role="status">
          <span />
          <p>Lighting the path…</p>
        </div>
      ) : null}

      {nearestMemory ? (
        <button
          className="memory-walk-prompt"
          onClick={() => openMemoryRef.current(nearestMemory.id)}
          type="button"
        >
          <span>Memory nearby</span>
          Open {nearestMemory.title}
          <kbd>Enter</kbd>
        </button>
      ) : null}

      <div className="memory-walk-controls" aria-label="Walking controls">
        <button
          type="button"
          aria-label="Walk left"
          onPointerDown={(event) => startDirectionalWalk(event, -1)}
          onPointerUp={stopDirectionalWalk}
          onPointerCancel={stopDirectionalWalk}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Walk right"
          onPointerDown={(event) => startDirectionalWalk(event, 1)}
          onPointerUp={stopDirectionalWalk}
          onPointerCancel={stopDirectionalWalk}
        >
          →
        </button>
      </div>

      <nav className="memory-walk-chapters" aria-label="Memory stops">
        {memories.map((memory, index) => (
          <button
            className={nearestMemoryId === memory.id ? "is-near" : ""}
            key={memory.id}
            onClick={() => controllerRef.current?.walkToMemory(memory.id)}
            type="button"
            aria-label={`Walk to memory ${index + 1}: ${memory.title}`}
          >
            {index + 1}
          </button>
        ))}
      </nav>

      <p className="memory-walk-instructions">
        Click the path or use A / D to walk · Stop near a glowing memory
      </p>
    </div>
  );
}
