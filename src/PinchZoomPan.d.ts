import React from 'react';
interface Props {
  initialScale?: number | 'auto';
  minScale?: number | 'auto';
  maxScale?: number;
  position?: 'center' | 'topLeft';
  zoomButtons?: boolean;
  doubleTapBehavior?: 'reset' | 'zoom';
}

declare const PinchZoomPan: React.FC<Props>;
export default PinchZoomPan;
