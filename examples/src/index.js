import React from "react";
import { render } from "react-dom";
import PinchZoomPan from "../../src/PinchZoomPan";

function App() {
    return (
        <div style={{ height: '100vh' }}>
            <nav><h1>Demo</h1></nav>
            <div style={{ width: '500px', height: '500px' }}>
                <PinchZoomPan>
                    <img alt='Demo Image' src='http://unsplash.it/750/750?random' />
                </PinchZoomPan>
            </div>
        </div>
    );
};

render(<App />, document.getElementById("root"));