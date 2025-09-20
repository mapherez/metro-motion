import { create } from 'zustand';

import type { Snapshot } from '@metro/shared-types';

type Store = {
  snapshot: Snapshot | null;
  setSnapshot: (s: Snapshot | null) => void;
};

export const useSnapshotStore = create<Store>((set) => ({
  snapshot: null,
  setSnapshot: (s) => set({ snapshot: s })
}));

