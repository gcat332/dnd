import { Compass, RotateCcw, Scan } from 'lucide-react'
import { useBattleMapView } from '../state/useBattleMapView'

export function CameraToolbar() {
  const requestCameraPreset = useBattleMapView((state) => state.requestCameraPreset)

  return (
    <div className="camera-toolbar" role="toolbar" aria-label="Camera view">
      <button
        className="camera-toolbar-button"
        type="button"
        title="Face north"
        aria-label="Face north"
        onClick={() => requestCameraPreset('north')}
      >
        <Compass size={18} aria-hidden="true" />
      </button>
      <button
        className="camera-toolbar-button"
        type="button"
        title="Top view"
        aria-label="Top view"
        onClick={() => requestCameraPreset('top')}
      >
        <Scan size={18} aria-hidden="true" />
      </button>
      <button
        className="camera-toolbar-button"
        type="button"
        title="Reset camera"
        aria-label="Reset camera"
        onClick={() => requestCameraPreset('reset')}
      >
        <RotateCcw size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
