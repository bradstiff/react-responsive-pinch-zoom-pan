# react-responsive-pinch-zoom-pan

A React component that adds pinch-zoom and pan capability to an `<img>` element. Both mobile and desktop browsers are supported. On desktop browsers, zoom is triggered via the mouse scrollwheel.

Zoom and pan are applied using CSS transforms. 

## Install

`npm install react-responsive-pinch-zoom-pan --save`

## Try it out

### Online

TBD

### Local

1. `git clone https://github.com/bradstiff/react-responsive-pinch-zoom-pan.git`
2. `cd react-responsive-pinch-zoom-pan`
3. `npm install`
4. `npm start`
5. Browse to http://localhost:3001

## Usage

```javascript
import React from "react";
import PinchZoomPan from "react-responsive-pinch-zoom-pan";

const App = () => {
    return (
        <div style={{ width: '500px', height: '500px' }}>
            <PinchZoomPan>
                <img alt='Test Image' src='http://via.placeholder.com/750x750' />
            </PinchZoomPan>
        </div>
    );
};
```

## API

Prop		| Type		| Default	| Description
------------|-----------|-----------|--------------------------------------------------------------------------------------------------------------------
initialTop	| number	| 0			| The initial top coordinate of the image with respect to the container.
initialLeft	| number	| 0			| The initial left coordinate of the image wiht respect to the container.
initialScale| number	| auto		| The initial scale of the image.  When `auto`, the image will be proportionally 'autofit' to the container.
minScale	| number	| auto		| The minimum scale to which the image can be zoomed out. When `auto`, the minimum scale is the 'autofit' scale.
maxScale	| number	| 1			| The maximum scale to which the image can be zoomed in. 
zoomButtons	| bool		| true		| When true, plus and minus buttons are rendered on top of the image as another way to access the zoom feature.

## Development

You're welcome to contribute to react-responsive-pinch-zoom-pan.

To set up the project:

1.  Fork and clone the repository
2.  `npm install`
3.  `npm start`

The example page will be available on http://localhost:3001 in watch mode, meaning you don't have refresh the page to see your changes.