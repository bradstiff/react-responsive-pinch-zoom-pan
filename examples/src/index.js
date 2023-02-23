import React from "react";
import { render } from "react-dom";
import PinchZoomPan from "../../src/PinchZoomPan";

function App() {
  const width = 300;
  const height = 500;
  const imageWidth = width * 2;
  const imageHeight = height * 2;
  return (
    <div>
      <main style={{ width: `${width}px`, height: `${height}px` }}>
      foox
        <PinchZoomPan doubleTapBehavior="zoom" style={{
          opacity: 0.1,
        }}>
          <img

            alt="Demo Image"
            src={`http://picsum.photos/${imageWidth}/${imageHeight}?random`}
          />
        </PinchZoomPan>
      </main>
    </div>
  );
}

render(<App />, document.getElementById("root"));
