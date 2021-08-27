# react-responsive-pinch-zoom-pan

A React component that adds pinch-zoom and pan capability to an `img` element. Both mobile and desktop browsers are supported. In desktop mode, you zoom with the mouse scrollwheel, and pan by dragging.

On render, the zoom and pan values are applied using CSS transforms. 

## Install

`npm install react-responsive-pinch-zoom-pan --save`

## Try it out

### Online

[Demo](https://bradstiff.github.io/react-responsive-pinch-zoom-pan/)

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
                <img alt='Test Image' src='http://picsum.photos/750/750' />
            </PinchZoomPan>
        </div>
    );
};
```

## API

Prop		| Type		| Default	| Description
------------|-----------|-----------|--------------------------------------------------------------------------------------------------------------------
initialScale| number	| 'auto'	| The initial scale of the image.  When `auto`, the image will be proportionally 'autofit' to the container.
minScale	| number	| 'auto'	| The minimum scale to which the image can be zoomed out. When `auto`, the minimum scale is the 'autofit' scale.
maxScale	| number	| 1			| The maximum scale to which the image can be zoomed in. 
position    | 'center' or 'topLeft'    | 'topLeft'  | Position of the image relative to the container. Applies when the scaled image is smaller than the container.
zoomButtons	| bool		| true		| Render plus (+) and minus (-) buttons on top of the image as another way to access the zoom feature.
doubleTapBehavior	| 'reset' or 'zoom' | 'reset'		| Whether to zoom in or reset to initial scale on double-click / double-tap.
onChange    | function  | () => {}  | A callback function that will receive the updated `left`, `scale`, and `top` values.

## Development

You're welcome to contribute to react-responsive-pinch-zoom-pan.

To set up the project:

1.  Fork and clone the repository
2.  `npm install`
3.  `npm start`

The example page will be available on http://localhost:3001 in watch mode, meaning you don't have to refresh the page to see your changes.
