import { create } from 'zustand'
import type { GridCell, WorldPoint } from '../domain/grid'

type BattleMapViewState = {
  cameraCenter: WorldPoint
  visibleCellSpan: number
  selectedTokenId: string | null
  dragPreview: { tokenId: string; cell: GridCell } | null
  setCamera: (center: WorldPoint, visibleCellSpan: number) => void
  selectToken: (tokenId: string | null) => void
  previewTokenMove: (tokenId: string, cell: GridCell) => void
  clearDragPreview: () => void
}

export const useBattleMapView = create<BattleMapViewState>((set) => ({
  cameraCenter: { x: 100, z: 100 },
  visibleCellSpan: 200,
  selectedTokenId: null,
  dragPreview: null,
  setCamera: (cameraCenter, visibleCellSpan) => set({ cameraCenter, visibleCellSpan }),
  selectToken: (selectedTokenId) => set({ selectedTokenId }),
  previewTokenMove: (tokenId, cell) => set({ dragPreview: { tokenId, cell } }),
  clearDragPreview: () => set({ dragPreview: null }),
}))
