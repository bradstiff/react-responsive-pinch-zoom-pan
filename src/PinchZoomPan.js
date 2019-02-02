import React from 'react';
import PropTypes from 'prop-types';
import ZoomButtons from './ZoomButtons'
import { snapToTarget, negate, constrain, getPinchLength, getPinchMidpoint, getRelativePosition, setRef, isEqualDimensions, getDimensions, getContainerDimensions, isEqualTransform, getMinScale, debug } from './Utils';

const SNAP_TOLERANCE = 0.001;
const OVERZOOM_TOLERANCE = 0.05;
const DOUBLE_TAP_THRESHOLD = 300;
const ANIMATION_SPEED = 0.1;

const containerStyle = { 
    width: '100%', 
    height: '100%',
    overflow: 'hidden'
};

//Ensure the image is not over-panned, and not over- or under-scaled.
//These constraints must be checked when image changes, and when container is resized.
export default class PinchZoomPan extends React.Component {
    state = {};

    lastPointerUpTimeStamp; //enables detecting double-tap
    lastPanPointerPosition;
    lastPinchLength;
    lastPinchMidpoint;
    mouseDown;
    animation;
    image;
    isImageLoaded; //permits initial transform
    shouldHandlePullDownRefresh;
    originalOverscrollBehaviorY;

    //event handlers
    handleTouchStart = (event) => {
        this.cancelAnimation();

        const touches = event.touches;
        if (touches.length === 2) {
            this.pinchStart(touches);
            this.lastPanPointerPosition = null;
        }
        else if (touches.length === 1) {
            this.pointerDown(touches[0]);
        }
    }

    handleTouchMove = (event) => {
        const touches = event.touches;
        if (touches.length === 2) {
            this.pinchChange(touches);
        }
        else if (touches.length === 1) {
            this.pan(touches[0]) > 0;
        }
    }

    handleTouchEnd = (event) => {
        if (event.touches && event.touches.length > 0) return null;
        this.cancelAnimation();

        //We allow transient +/-5% over-pinching.
        //Animate the bounce back to constraints if applicable.
        this.maybeAdjustCurrentTransform(ANIMATION_SPEED);

        this.pointerUp(event.timeStamp);

        //suppress mouseUp, in case of tap
        this.cancelEvent(event);
    }

    handleMouseDown = (event) => {
        this.cancelAnimation();
        this.mouseDown = true;
        this.pointerDown(event);
    }

    handleMouseMove = (event) => {
        if (!this.mouseDown) return null;
        this.pan(event)
    }

    handleMouseUp = (event) => {
        this.cancelAnimation();
        this.pointerUp(event.timeStamp);
        if (this.mouseDown) {
            this.mouseDown = false;
        }
    }

    handleMouseWheel = (event) => {
        this.cancelAnimation();
        const point = getRelativePosition(event, this.image.parentNode);
        if (event.deltaY > 0) {
            if (this.state.scale > getMinScale(this.state, this.props)) {
                this.zoomOut(point);
                this.cancelEvent(event);
            }
        } else if (event.deltaY < 0) {
            if (this.state.scale < this.props.maxScale) {
                this.zoomIn(point);
                this.cancelEvent(event);
            }
        }
    }

    handleImageLoad = event => {
        debug('handleImageLoad'); 
        this.isImageLoaded = true;
        this.maybeHandleDimensionsChanged();

        const { onLoad } = React.Children.only(this.props.children);
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
    
    cancelEvent = event => {
        if (event.cancelable) {
            event.preventDefault();
        }
    }

    handleRefImage = ref => {
        if (this.image) {
            this.cancelAnimation();
            this.image.removeEventListener('touchmove', this.handleTouchMove);
        }

        this.image = ref;
        if (ref) {
            this.image.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        }

        const { ref: imageRefProp } = React.Children.only(this.props.children);
        setRef(imageRefProp, ref);
    };

    //actions
    pointerDown(clientPosition) {
        this.lastPanPointerPosition = getRelativePosition(clientPosition, this.image.parentNode);
    }

    pan(pointerClientPosition) {
        if (!this.lastPanPointerPosition) {
            //if we were pinching and lifted a finger
            this.pointerDown(pointerClientPosition);
            return 0;
        }

        const pointerPosition = getRelativePosition(pointerClientPosition, this.image.parentNode);
        const translateX = pointerPosition.x - this.lastPanPointerPosition.x;
        const translateY = pointerPosition.y - this.lastPanPointerPosition.y;
        const top = this.state.top + translateY;
        const left = this.state.left + translateX;

        //use 0 tolerance to prevent over-panning (doesn't look good)
        this.move(top, left, 0)
        this.lastPanPointerPosition = pointerPosition;
        return translateY > 0 ? 1 //swiping down
            : translateY < 0 ? -1 //swiping up
            : 0;
    }

    pointerUp(timeStamp) {
        if (this.lastPointerUpTimeStamp && this.lastPointerUpTimeStamp + DOUBLE_TAP_THRESHOLD > timeStamp) {
            this.doubleTap(this.lastPanPointerPosition);
        }

        this.lastPointerUpTimeStamp = timeStamp;
    }

    doubleTap(pointerPosition) {
        if (String(this.props.doubleTapBehavior).toLowerCase() === 'zoom' && this.state.scale * (1 + OVERZOOM_TOLERANCE) < this.props.maxScale) {
            this.zoomIn(pointerPosition, ANIMATION_SPEED, 0.3);
        } else {
            //reset
            this.applyInitialTransform(ANIMATION_SPEED);
        }
    }

    move(top, left, tolerance, speed = 0) {
        if (!this.isTransformInitialized) {
            return;
        }
        this.constrainAndApplyTransform(top, left, this.state.scale, tolerance, speed);
    }

    pinchStart(touches) {
        this.lastPinchLength = getPinchLength(touches);
    }

    pinchChange(touches) {
        const length = getPinchLength(touches);
        const midpoint = getPinchMidpoint(touches);
        const scale = this.state.scale * length / this.lastPinchLength;

        this.zoom(scale, midpoint, OVERZOOM_TOLERANCE);

        this.lastPinchMidpoint = midpoint;
        this.lastPinchLength = length;
    }

    zoomIn(midpoint, speed = 0, factor = 0.05) {
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
        this.zoom(this.state.scale * 0.95, midpoint, 0);
    }

    zoom(requestedScale, midpoint, tolerance, speed = 0) {
        if (!this.isTransformInitialized) {
            return;
        }

        const scale = this.getConstrainedScale(requestedScale, tolerance);

        const incrementalScalePercentage = (this.state.scale - scale) / this.state.scale;
        const translateY = (midpoint.y - this.state.top) * incrementalScalePercentage;
        const translateX = (midpoint.x - this.state.left) * incrementalScalePercentage;

        const top = this.state.top + translateY;
        const left = this.state.left + translateX;

        this.constrainAndApplyTransform(top, left, scale, tolerance, speed);
    }

    //compare stored dimensions to actual dimensions; capture actual dimensions if different
    maybeHandleDimensionsChanged() {
        if (this.isImageReady) {
            const containerDimensions = getContainerDimensions(this.image);
            const imageDimensions = getDimensions(this.image);

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
                debug(`Dimensions changed: Container: ${containerDimensions.width}, ${containerDimensions.height}, Image: ${imageDimensions.width}, ${imageDimensions.height}`);
            }
        }
        else {
            debug('Image not loaded');
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
        debug(`Requesting transform: left ${requestedLeft}, top ${requestedTop}, scale ${requestedScale}`);

        //Correct the transform if needed to prevent overpanning and overzooming
        const transform = this.getCorrectedTransform(requestedTransform, tolerance) || requestedTransform;
        debug(`Applying transform: left ${transform.left}, top ${transform.top}, scale ${transform.scale}`);

        if (! isEqualTransform(transform, this.state) ) {
            this.applyTransform(transform, speed);
        }
    }

    applyTransform({ top, left, scale }, speed) {
        if (speed > 0) {
            const frame = () => {
                const translateY = top - this.state.top;
                const translateX = left - this.state.left;
                const translateScale = scale - this.state.scale;

                const nextTransform = {
                    top: snapToTarget(this.state.top + (speed * translateY), top, SNAP_TOLERANCE),
                    left: snapToTarget(this.state.left + (speed * translateX), left, SNAP_TOLERANCE),
                    scale: snapToTarget(this.state.scale + (speed * translateScale), scale, SNAP_TOLERANCE),
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
        const upperBoundFactor = 1.0 + tolerance;
        const negativeSpace = this.calculateNegativeSpace(scale);
        const overflow = {
            width: Math.max(0, negate(negativeSpace.width)),
            height: Math.max(0, negate(negativeSpace.height)),
        };

        //prevent moving by more than the overflow
        //example: overflow.height = 100, tolerance = 0.05 => top is constrained between -105 and +5
        const top = constrain(negate(overflow.height) * upperBoundFactor, overflow.height * upperBoundFactor - overflow.height, requestedTransform.top);
        const left = constrain(negate(overflow.width) * upperBoundFactor, overflow.width * upperBoundFactor - overflow.width, requestedTransform.left);

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
        this.constrainAndApplyTransform(this.props.initialTop, this.props.initialLeft, getMinScale(this.state, this.props), 0, speed);
    }

    //lifecycle methods
    render() {
        const childElement = React.Children.only(this.props.children);
        const { zoomButtons, maxScale } = this.props;
        const { top, left, scale } = this.state;
        
        const transformStyle = this.isTransformInitialized && {
                transform: `translate3d(${left}px, ${top}px, 0) scale(${scale})`,
                transformOrigin: '0 0',
        };

        const style = {
            cursor: 'pointer',
            ...transformStyle
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
                {React.cloneElement(childElement, {
                    onTouchStart: this.handleTouchStart,
                    onTouchEnd: this.handleTouchEnd,
                    onMouseDown: this.handleMouseDown,
                    onMouseMove: this.handleMouseMove,
                    onMouseUp: this.handleMouseUp,
                    onWheel: this.handleMouseWheel,
                    onDragStart: this.cancelEvent,
                    onLoad: this.handleImageLoad,
                    ref: this.handleRefImage,
                    style: style
                })}
            </div>
        );
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.initialTop !== prevState.initialTop ||
            nextProps.initialLeft !== prevState.initialLeft ||
            nextProps.initialScale !== prevState.initialScale) {
            return {
                initialTop: nextProps.initialTop,
                initialLeft: nextProps.initialLeft,
                initialScale: nextProps.initialScale,
            };
        } else {
            return null;
        }
    }

    componentDidMount() {
        window.addEventListener("resize", this.handleWindowResize);
        this.maybeHandleDimensionsChanged();
        this.initShouldHandlePullDownRefresh();
        this.maybePreventPullDownRefresh();
    }

    componentDidUpdate(prevProps, prevState) {
        this.maybeHandleDimensionsChanged();
        this.maybePreventPullDownRefresh();
    }

    componentWillUnmount() {
        this.cancelAnimation();
        this.image.removeEventListener('touchmove', this.handleTouchMove);
        window.removeEventListener('resize', this.handleWindowResize);
    }

    get isImageReady() {
        return this.isImageLoaded || (this.image && this.image.tagName !== 'IMG');
    }

    get isTransformInitialized() {
        return this.state.scale !== undefined &&
            this.state.left !== undefined && 
            this.state.top !== undefined;
    }

    initShouldHandlePullDownRefresh() {
        try {
            const isChrome = window.chrome || navigator.userAgent.match('CriOS');
            const isTouch = 'ontouchstart' in document.documentElement;
            const supportsOverscroll = CSS.supports('overscroll-behavior-y', 'none');
            this.shouldHandlePullDownRefresh = isChrome && isTouch && supportsOverscroll;
        } catch (e) {
            this.shouldHandlePullDownRefresh = false;
        }
    }

    maybePreventPullDownRefresh() {
        if (!this.shouldHandlePullDownRefresh) {
            return;
        }
        const overscrollBehaviorY = document.body.style.overscrollBehaviorY;
        if (this.state.top < 0 && overscrollBehaviorY != 'none' && overscrollBehaviorY != 'contain' ) {
            //disable pull down refresh so user can scroll image
            this.originalOverscrollBehaviorY = overscrollBehaviorY;
            document.body.style.overscrollBehaviorY = 'none';
        } else if (this.state.top === 0 && overscrollBehaviorY === 'none' && this.originalOverscrollBehaviorY !== undefined) {
            //restore original value
            document.body.style.overscrollBehaviorY = this.originalOverscrollBehaviorY;
            this.originalOverscrollBehaviorY = undefined;
        }
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
}

PinchZoomPan.defaultProps = {
    initialTop: 0,
    initialLeft: 0,
    initialScale: 'auto',
    minScale: 'auto',
    maxScale: 1,
    zoomButtons: true,
    doubleTapBehavior: 'reset'
};

PinchZoomPan.propTypes = {
    children: PropTypes.element.isRequired,
    initialTop: PropTypes.number,
    initialLeft: PropTypes.number,
    initialScale: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
    ]),
    minScale: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
    ]),
    maxScale: PropTypes.number,
    zoomButtons: PropTypes.bool,
    doubleTapBehavior: PropTypes.oneOf(['reset', 'zoom']),
};
