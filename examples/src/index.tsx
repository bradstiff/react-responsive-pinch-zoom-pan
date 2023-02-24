import React from 'react'
import { createRoot } from 'react-dom/client'
import { PinchZoomPanImage } from '../../src/PinchZoomPanImage'

function App() {
  const width = 300
  const height = 500
  const imageWidth = width * 2
  const imageHeight = height * 2
  return (
    <div>
      <main style={{ width: `${width}px`, height: `${height}px` }}>
        <PinchZoomPanImage
          animate
          maxScale={5}
          doubleTapBehavior="reset"
          position="center"
          src={`http://picsum.photos/${imageWidth}/${imageHeight}?random`}
        />
      </main>
    </div>
  )
}

const container = document.getElementById('root')

if (!container) throw new Error('HTML missing root element!')
const root = createRoot(container)

root.render(<App />)
