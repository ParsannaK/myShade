export type MemoryWalkMemory = {
  id: string;
  title: string;
};

export type MemoryWalkController = {
  destroy: () => void;
  interact: () => void;
  move: (direction: -1 | 0 | 1) => void;
  setPaused: (paused: boolean) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  walkToMemory: (memoryId: string) => void;
};

export type MemoryWalkCallbacks = {
  onNearestMemoryChange: (memoryId: string | null) => void;
  onOpenMemory: (memoryId: string) => void;
  onProgressChange: (progress: number) => void;
  onReady: () => void;
  onWalkingChange: (walking: boolean) => void;
};
