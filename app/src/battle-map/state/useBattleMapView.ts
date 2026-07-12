import { create } from 'zustand'
import {
  DEFAULT_CAMERA_VIEW,
  type CameraPreset,
  type CameraView,
} from '../camera/cameraView'
import type { GridCell } from '../domain/grid'

type BattleMapViewState = {
  cameraView: CameraView
  visibleCellSpan: number
  cameraCommand: { sequence: number; preset: CameraPreset } | null
  cameraCommandSequence: number
  selectedTokenId: string | null
  dragPreview: { tokenId: string; cell: GridCell } | null
  publishCameraView: (view: CameraView, visibleCellSpan: number) => void
  requestCameraPreset: (preset: CameraPreset) => void
  acknowledgeCameraCommand: (sequence: number) => void
  selectToken: (tokenId: string | null) => void
  previewTokenMove: (tokenId: string, cell: GridCell) => void
  clearDragPreview: () => void
}

export const useBattleMapView = create<BattleMapViewState>((set) => ({
  cameraView: DEFAULT_CAMERA_VIEW,
  visibleCellSpan: 200,
  cameraCommand: null,
  cameraCommandSequence: 0,
  selectedTokenId: null,
  dragPreview: null,
  publishCameraView: (cameraView, visibleCellSpan) => set({ cameraView, visibleCellSpan }),
  requestCameraPreset: (preset) =>
    set((state) => ({
      cameraCommandSequence: state.cameraCommandSequence + 1,
      cameraCommand: {
        sequence: state.cameraCommandSequence + 1,
        preset,
      },
    })),
  acknowledgeCameraCommand: (sequence) =>
    set((state) => state.cameraCommand?.sequence === sequence ? { cameraCommand: null } : state),
  selectToken: (selectedTokenId) => set({ selectedTokenId }),
  previewTokenMove: (tokenId, cell) => set({ dragPreview: { tokenId, cell } }),
  clearDragPreview: () => set({ dragPreview: null }),
}))
