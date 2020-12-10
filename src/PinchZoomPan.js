import React from 'react';
import PropTypes from 'prop-types';
import { createSelector } from 'reselect';
import warning from 'warning';

import ZoomButtons from './ZoomButtons'
import DebugView from './StateDebugView';

import { snapToTarget, negate, constrain, getPinchLength, getPinchMidpoint, getRelativePosition, setRef, isEqualDimensions, getDimensions, getContainerDimensions, isEqualTransform, getAutofitScale, getMinScale, tryCancelEvent, getImageOverflow } from './Utils';

const OVERZOOM_TOLERANCE = 0.05;
const DOUBLE_TAP_THRESHOLD = 250;
const ANIMATION_SPEED = 0.1;

const isInitialized = (top, left, scale) => scale !== undefined && left !== undefined && top !== undefined;

const imageStyle = createSelector(
    state => state.top,
    state => state.left,
    state => state.scale,
    (top, left, scale) => {
        const style = {
            cursor: 'pointer',
        };
        return isInitialized(top, left, scale)
            ? {
                ...style,
                transform: `translate3d(${left}px, ${top}px, 0) scale(${scale})`,
                transformOrigin: '0 0',
            } : style;
    }
);

const imageOverflow = createSelector(
    state => state.top,
    state => state.left,
    state => state.scale,
    state => state.imageDimensions,
    state => state.containerDimensions,
    (top, left, scale, imageDimensions, containerDimensions) => { 
        if (!isInitialized(top, left, scale)) {
            return '';
        } 
        return getImageOverflow(top, left, scale, imageDimensions, containerDimensions);
    }
);

const browserPanActions = createSelector(
    imageOverflow,
    (imageOverflow) => { 
        //Determine the panning directions where there is no image overflow and let
        //the browser handle those directions (e.g., scroll viewport if possible).
        //Need to replace 'pan-left pan-right' with 'pan-x', etc. otherwise 
        //it is rejected (o_O), therefore explicitly handle each combination.
        const browserPanX = 
            !imageOverflow.left && !imageOverflow.right ? 'pan-x' //we can't pan the image horizontally, let the browser take it
            : !imageOverflow.left ? 'pan-left'
            : !imageOverflow.right ? 'pan-right'
            : '';
        const browserPanY = 
            !imageOverflow.top && !imageOverflow.bottom ? 'pan-y'
            : !imageOverflow.top ? 'pan-up'
            : !imageOverflow.bottom ? 'pan-down'
            : '';
        return [browserPanX, browserPanY].join(' ').trim();
    }
);

//Ensure the image is not over-panned, and not over- or under-scaled.
//These constraints must be checked when image changes, and when container is resized.
export default class PinchZoomPan extends React.Component {
    state = {};

    lastPointerUpTimeStamp; //enables detecting double-tap
    lastPanPointerPosition; //helps determine how far to pan the image
    lastPinchLength; //helps determine if we are pinching in or out
    animation; //current animation handle
    imageRef; //image element
    isImageLoaded; //permits initial transform
    originalOverscrollBehaviorY; //saves the original overscroll-behavior-y value while temporarily preventing pull down refresh

    //event handlers
    handleTouchStart = event => {
        this.cancelAnimation();

        const touches = event.touches;
        if (touches.length === 2) {
            this.lastPinchLength = getPinchLength(touches);
            this.lastPanPointerPosition = null;
        }
        else if (touches.length === 1) {
            this.lastPinchLength = null;
            this.pointerDown(touches[0]);
            tryCancelEvent(event); //suppress mouse events
        }
    }

    handleTouchMove = event => {
        const touches = event.touches;
        if (touches.length === 2) {
            this.pinchChange(touches);

            //suppress viewport scaling on iOS
            tryCancelEvent(event);
        }
        else if (touches.length === 1) {
            const requestedPan = this.pan(touches[0]);

            if (!this.controlOverscrollViaCss) {
                //let the browser handling panning if we are at the edge of the image in 
                //both pan directions, or if we are primarily panning in one direction
                //and are at the edge in that directino
                const overflow = imageOverflow(this.state);
                const hasOverflowX = (requestedPan.left && overflow.left > 0) || (requestedPan.right && overflow.right > 0);
                const hasOverflowY = (requestedPan.up && overflow.top > 0) ||  (requestedPan.down && overflow.bottom > 0);

                if (!hasOverflowX && !hasOverflowY) {
                    //no overflow in both directions
                    return;
                }

                const panX = requestedPan.left || requestedPan.right;
                const panY = requestedPan.up || requestedPan.down;
                if (panY > 2 * panX && !hasOverflowY) {
                    //primarily panning up or down and no overflow in the Y direction
                    return;
                }

                if (panX > 2 * panY && !hasOverflowX) {
                    //primarily panning left or right and no overflow in the X direction
                    return;
                }

                tryCancelEvent(event);
            }
        }
    }

    handleTouchEnd = event => {
        this.cancelAnimation();
        if (event.touches.length === 0 && event.changedTouches.length === 1) {
            if (this.lastPointerUpTimeStamp && this.lastPointerUpTimeStamp + DOUBLE_TAP_THRESHOLD > event.timeStamp) {
                const pointerPosition = getRelativePosition(event.changedTouches[0], this.imageRef.parentNode);
                this.doubleClick(pointerPosition);
            }
            this.lastPointerUpTimeStamp = event.timeStamp;
            tryCancelEvent(event); //suppress mouse events
        }

        //We allow transient +/-5% over-pinching.
        //Animate the bounce back to constraints if applicable.
        this.maybeAdjustCurrentTransform(ANIMATION_SPEED);
        return;
    }

    handleMouseDown = event => {
        this.cancelAnimation();
        this.pointerDown(event);
    }

    handleMouseMove = event => {
        if (!event.buttons) return null;
        this.pan(event)
    }

    handleMouseDoubleClick = event => {
        this.cancelAnimation();
        var pointerPosition = getRelativePosition(event, this.imageRef.parentNode);
        this.doubleClick(pointerPosition);
    }

    handleMouseWheel = event => {
        if (this.props.disableWheel) return null;

        this.cancelAnimation();
        const point = getRelativePosition(event, this.imageRef.parentNode);
        if (event.deltaY > 0) {
            if (this.state.scale > getMinScale(this.state, this.props)) {
                this.zoomOut(point);
                tryCancelEvent(event);
            }
        } else if (event.deltaY < 0) {
            if (this.state.scale < this.props.maxScale) {
                this.zoomIn(point);
                tryCancelEvent(event);
            }
        }
    }

    handleImageLoad = event => {
        this.debug('handleImageLoad'); 
        this.isImageLoaded = true;
        this.maybeHandleDimensionsChanged();

        const { onLoad } = React.Children.only(this.props.children).props;
        if (typeof onLoad === 'function') {
            onLoad(event);
        }
    }

    handleZoomInClick = () => {
        this.cancelAnimation();
        this.zoomIn();
    }

    handleZoomOutClick = () => {
        this.cancelAnimation();
        this.zoomOut();
    }

    handleWindowResize = () => this.maybeHandleDimensionsChanged();

    handleRefImage = ref => {
        if (this.imageRef) {
            this.cancelAnimation();
            this.imageRef.removeEventListener('touchmove', this.handleTouchMove);
        }

        this.imageRef = ref;
        if (ref) {
            this.imageRef.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        }

        const { ref: imageRefProp } = React.Children.only(this.props.children);
        setRef(imageRefProp, ref);
    };

    //actions
    pointerDown(clientPosition) {
        this.lastPanPointerPosition = getRelativePosition(clientPosition, this.imageRef.parentNode);
    }

    pan(pointerClientPosition) {
        if (!this.isTransformInitialized) {
            return;
        }

        if (!this.lastPanPointerPosition) {
            //if we were pinching and lifted a finger
            this.pointerDown(pointerClientPosition);
            return 0;
        }

        const pointerPosition = getRelativePosition(pointerClientPosition, this.imageRef.parentNode);
        const translateX = pointerPosition.x - this.lastPanPointerPosition.x;
        const translateY = pointerPosition.y - this.lastPanPointerPosition.y;
        this.lastPanPointerPosition = pointerPosition;

        const top = this.state.top + translateY;
        const left = this.state.left + translateX;
        this.constrainAndApplyTransform(top, left, this.state.scale, 0, 0);

        return {
            up: translateY > 0 ? translateY : 0,
            down: translateY < 0 ? negate(translateY) : 0,
            right: translateX < 0 ? negate(translateX) : 0,
            left: translateX > 0 ? translateX : 0,
        };
    }

    doubleClick(pointerPosition) {
        if (String(this.props.doubleTapBehavior).toLowerCase() === 'zoom' && this.state.scale * (1 + OVERZOOM_TOLERANCE) < this.props.maxScale) {
            this.zoomIn(pointerPosition, ANIMATION_SPEED, 0.3);
        } else {
            //reset
            this.applyInitialTransform(ANIMATION_SPEED);
        }
    }

    pinchChange(touches) {
        const length = getPinchLength(touches);
        const midpoint = getPinchMidpoint(touches);
        const scale = this.lastPinchLength
            ? this.state.scale * length / this.lastPinchLength //sometimes we get a touchchange before a touchstart when pinching
            : this.state.scale;

        this.zoom(scale, midpoint, OVERZOOM_TOLERANCE);

        this.lastPinchLength = length;
    }

    zoomIn(midpoint, speed = 0, factor = 0.1) {
        midpoint = midpoint || {
            x: this.state.containerDimensions.width / 2,
            y: this.state.containerDimensions.height / 2
        };
        this.zoom(this.state.scale * (1 + factor), midpoint, 0, speed);
    }

    zoomOut(midpoint) {
        midpoint = midpoint || {
            x: this.state.containerDimensions.width / 2,
            y: this.state.containerDimensions.height / 2
        };
        this.zoom(this.state.scale * 0.9, midpoint, 0);
    }

    zoom(requestedScale, containerRelativePoint, tolerance, speed = 0) {
        if (!this.isTransformInitialized) {
            return;
        }

        const { scale, top, left } = this.state;
        const imageRelativePoint = {
            top: containerRelativePoint.y - top,
            left: containerRelativePoint.x - left,
        };

        const nextScale = this.getConstrainedScale(requestedScale, tolerance);
        const incrementalScalePercentage = (nextScale - scale) / scale;
        const translateY = imageRelativePoint.top * incrementalScalePercentage;
        const translateX = imageRelativePoint.left * incrementalScalePercentage;

        const nextTop = top - translateY;
        const nextLeft = left - translateX;

        this.constrainAndApplyTransform(nextTop, nextLeft, nextScale, tolerance, speed);
    }

    //compare stored dimensions to actual dimensions; capture actual dimensions if different
    maybeHandleDimensionsChanged() {
        if (this.isImageReady) {
            const containerDimensions = getContainerDimensions(this.imageRef);
            const imageDimensions = getDimensions(this.imageRef);

            if (!isEqualDimensions(containerDimensions, getDimensions(this.state.containerDimensions)) || 
                !isEqualDimensions(imageDimensions, getDimensions(this.state.imageDimensions))) {
                this.cancelAnimation();

                //capture new dimensions
                this.setState({
                        containerDimensions,
                        imageDimensions
                    }, 
                    () => {
                        //When image loads and image dimensions are first established, apply initial transform.
                        //If dimensions change, constraints change; current transform may need to be adjusted.
                        //Transforms depend on state, so wait until state is updated.
                        if (!this.isTransformInitialized) {
                            this.applyInitialTransform();
                        } else {
                            this.maybeAdjustCurrentTransform();
                        }
                    }
                );
                this.debug(`Dimensions changed: Container: ${containerDimensions.width}, ${containerDimensions.height}, Image: ${imageDimensions.width}, ${imageDimensions.height}`);
            }
        }
        else {
            this.debug('Image not loaded');
        }
    }

    //transformation methods

    //Zooming and panning cause transform to be requested.
    constrainAndApplyTransform(requestedTop, requestedLeft, requestedScale, tolerance, speed = 0) {
        const requestedTransform = {
            top: requestedTop,
            left: requestedLeft,
            scale: requestedScale
        };
        this.debug(`Requesting transform: left ${requestedLeft}, top ${requestedTop}, scale ${requestedScale}`);

        //Correct the transform if needed to prevent overpanning and overzooming
        const transform = this.getCorrectedTransform(requestedTransform, tolerance) || requestedTransform;
        this.debug(`Applying transform: left ${transform.left}, top ${transform.top}, scale ${transform.scale}`);

        if (isEqualTransform(transform, this.state)) {
            return false;
        }

        this.applyTransform(transform, speed);
        return true;
    }

    applyTransform({ top, left, scale }, speed) {
        if (speed > 0) {
            const frame = () => {
                const translateY = top - this.state.top;
                const translateX = left - this.state.left;
                const translateScale = scale - this.state.scale;

                const nextTransform = {
                    top: snapToTarget(this.state.top + (speed * translateY), top, 1),
                    left: snapToTarget(this.state.left + (speed * translateX), left, 1),
                    scale: snapToTarget(this.state.scale + (speed * translateScale), scale, 0.001),
                };

                //animation runs until we reach the target
                if (!isEqualTransform(nextTransform, this.state)) {
                    this.setState(nextTransform, () => this.animation = requestAnimationFrame(frame));
                }
            };
            this.animation = requestAnimationFrame(frame);
        } else {
            this.setState({
                top,
                left,
                scale,
            });
        }
    }

    //Returns constrained scale when requested scale is outside min/max with tolerance, otherwise returns requested scale
    getConstrainedScale(requestedScale, tolerance) {
        const lowerBoundFactor = 1.0 - tolerance;
        const upperBoundFactor = 1.0 + tolerance;

        return constrain(
            getMinScale(this.state, this.props) * lowerBoundFactor,
            this.props.maxScale * upperBoundFactor,
            requestedScale
        );
    }

    //Returns constrained transform when requested transform is outside constraints with tolerance, otherwise returns null
    getCorrectedTransform(requestedTransform, tolerance) {
        const scale = this.getConstrainedScale(requestedTransform.scale, tolerance);

        //get dimensions by which scaled image overflows container
        const negativeSpace = this.calculateNegativeSpace(scale);
        const overflow = {
            width: Math.max(0, negate(negativeSpace.width)),
            height: Math.max(0, negate(negativeSpace.height)),
        };

        //if image overflows container, prevent moving by more than the overflow
        //example: overflow.height = 100, tolerance = 0.05 => top is constrained between -105 and +5
        const { position, initialTop, initialLeft } = this.props;
        const { imageDimensions, containerDimensions } = this.state;
        const upperBoundFactor = 1.0 + tolerance;
        const top = 
            overflow.height ? constrain(negate(overflow.height) * upperBoundFactor, overflow.height * upperBoundFactor - overflow.height, requestedTransform.top)
            : position === 'center' ? (containerDimensions.height - (imageDimensions.height * scale)) / 2
            : initialTop || 0;

        const left = 
            overflow.width ? constrain(negate(overflow.width) * upperBoundFactor, overflow.width * upperBoundFactor - overflow.width, requestedTransform.left)
            : position === 'center' ? (containerDimensions.width - (imageDimensions.width * scale)) / 2
            : initialLeft || 0;

        const constrainedTransform = {
            top,
            left,
            scale
        };

        return isEqualTransform(constrainedTransform, requestedTransform)
            ? null
            : constrainedTransform;
    }

    //Ensure current transform is within constraints
    maybeAdjustCurrentTransform(speed = 0) {
        let correctedTransform;
        if (correctedTransform = this.getCorrectedTransform(this.state, 0)) {
            this.applyTransform(correctedTransform, speed);
        }
    }

    applyInitialTransform(speed = 0) {
        const { imageDimensions, containerDimensions } = this.state;
        const { position, initialScale, maxScale, initialTop, initialLeft } = this.props;

        const scale = String(initialScale).toLowerCase() === 'auto'
            ? getAutofitScale(containerDimensions, imageDimensions)
            : initialScale;
            const minScale = getMinScale(this.state, this.props);

        if (minScale > maxScale) {
            warning(false, 'minScale cannot exceed maxScale.');
            return;
        }
        if (scale < minScale || scale > maxScale) {
            warning(false, 'initialScale must be between minScale and maxScale.');
            return;
        }

        let initialPosition;
        if (position === 'center') {
            warning(initialTop === undefined, 'initialTop prop should not be supplied with position=center. It was ignored.');
            warning(initialLeft === undefined, 'initialLeft prop should not be supplied with position=center. It was ignored.');
            initialPosition = {
                top: (containerDimensions.width - (imageDimensions.width * scale)) / 2,
                left: (containerDimensions.height - (imageDimensions.height * scale)) / 2,
            };
        } else {
            initialPosition = {
                top: initialTop || 0,
                left: initialLeft || 0,
            };
        }

        this.constrainAndApplyTransform(initialPosition.top, initialPosition.left, scale, 0, speed);
    }

    //lifecycle methods
    render() {
        const childElement = React.Children.only(this.props.children);
        const { zoomButtons, maxScale, debug } = this.props;
        const { scale } = this.state;

        const touchAction = this.controlOverscrollViaCss
            ? browserPanActions(this.state) || 'none'
            : undefined;

        const containerStyle = {
            width: '100%', 
            height: '100%',
            overflow: 'hidden',
            touchAction: touchAction,
        };

        return (
            <div style={containerStyle}>
                {zoomButtons && this.isImageReady && this.isTransformInitialized && <ZoomButtons 
                    scale={scale} 
                    minScale={getMinScale(this.state, this.props)} 
                    maxScale={maxScale} 
                    onZoomOutClick={this.handleZoomOutClick} 
                    onZoomInClick={this.handleZoomInClick} 
                />}
                {debug && <DebugView {...this.state} overflow={imageOverflow(this.state)} />}
                {React.cloneElement(childElement, {
                    onTouchStart: this.handleTouchStart,
                    onTouchEnd: this.handleTouchEnd,
                    onMouseDown: this.handleMouseDown,
                    onMouseMove: this.handleMouseMove,
                    onDoubleClick: this.handleMouseDoubleClick,
                    onWheel: this.handleMouseWheel,
                    onDragStart: tryCancelEvent,
                    onLoad: this.handleImageLoad,
                    onContextMenu: tryCancelEvent,
                    ref: this.handleRefImage,
                    style: imageStyle(this.state)
                })}
            </div>
        );
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.initialTop !== prevState.initialTop ||
            nextProps.initialLeft !== prevState.initialLeft ||
            nextProps.initialScale !== prevState.initialScale || 
            nextProps.position !== prevState.position) {
            return {
                position: nextProps.position,
                initialScale: nextProps.initialScale,
                initialTop: nextProps.initialTop,
                initialLeft: nextProps.initialLeft,
            };
        } else {
            return null;
        }
    }

    componentDidMount() {
        window.addEventListener("resize", this.handleWindowResize);
        this.maybeHandleDimensionsChanged();
    }

    componentDidUpdate(prevProps, prevState) {
        this.maybeHandleDimensionsChanged();
    }

    componentWillUnmount() {
        this.cancelAnimation();
        this.imageRef.removeEventListener('touchmove', this.handleTouchMove);
        window.removeEventListener('resize', this.handleWindowResize);
    }

    get isImageReady() {
        return this.isImageLoaded || (this.imageRef && this.imageRef.tagName !== 'IMG');
    }

    get isTransformInitialized() {
        return isInitialized(this.state.top, this.state.left, this.state.scale);
    }

    get controlOverscrollViaCss() {
        return window.CSS && window.CSS.supports('touch-action', 'pan-up');
    }

    calculateNegativeSpace(scale) {
        //get difference in dimension between container and scaled image
        const { containerDimensions, imageDimensions } = this.state;
        const width = containerDimensions.width - (scale * imageDimensions.width);
        const height = containerDimensions.height - (scale * imageDimensions.height);
        return {
            width,
            height
        };
    }

    cancelAnimation() {
        if (this.animation) {
            cancelAnimationFrame(this.animation);
        }
    }

    debug(message) {
        if (this.props.debug) {    
            console.log(message);
        }
    }
}

PinchZoomPan.defaultProps = {
    initialScale: 'auto',
    minScale: 'auto',
    maxScale: 1,
    position: 'topLeft',
    zoomButtons: true,
    doubleTapBehavior: 'reset',
    disableWheel: false,
};

PinchZoomPan.propTypes = {
    children: PropTypes.element.isRequired,
    initialScale: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
    ]),
    minScale: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
    ]),
    maxScale: PropTypes.number,
    position: PropTypes.oneOf(['topLeft', 'center']),
    zoomButtons: PropTypes.bool,
    doubleTapBehavior: PropTypes.oneOf(['reset', 'zoom']),
    initialTop: PropTypes.number,
    initialLeft: PropTypes.number,
    disableWheel: PropTypes.bool,
};
