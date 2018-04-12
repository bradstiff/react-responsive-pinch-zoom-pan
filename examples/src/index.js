import React from "react";
import { render } from "react-dom";
import PinchZoomPan from "../../dist/PinchZoomPan";

const App = () => {
    return (
        <div>
            <h1>Demo</h1>
            <div style={{ width: '500px', height: '500px' }}>
                <PinchZoomPan>
                    <img alt='Demo Image' src='http://via.placeholder.com/750x750' />
                </PinchZoomPan>
            </div>
        </div>
    );
};

render(<App />, document.getElementById("root"));