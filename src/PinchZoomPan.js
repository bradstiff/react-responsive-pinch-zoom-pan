import React from 'react';
import PropTypes from 'prop-types';
import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faPlus from '@fortawesome/fontawesome-free-solid/faPlus';
import faMinus from '@fortawesome/fontawesome-free-solid/faMinus';
import './styles.css';

const SNAP_TOLERANCE = 0.001;
const OVER_TRANSFORMATION_TOLERANCE = 0.05;
const DOUBLE_TAP_THRESHOLD = 300;
const ANIMATION_SPEED = 0.1;

const snapToTarget = (value, target, tolerance) => {
    const withinRange = Math.abs(target - value) < tolerance;
    return withinRange ? target : value;
};

const rangeBind = (lowerBound, upperBound, value) => Math.min(upperBound, Math.max(lowerBound, value));

const invert = (value) => value * -1;

const getRelativePosition = ({ clientX, clientY }, relativeToElement) => {
    const rect = relativeToElement.getBoundingClientRect();
    return {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
};

const getMidpoint = (pointA, pointB) => ({
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
});

const getDistanceBetweenPoints = (pointA, pointB) => (
    Math.sqrt(Math.pow(pointA.y - pointB.y, 2) + Math.pow(pointA.x - pointB.x, 2))
);

const ZoomOutButton = ({ disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px' }} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon icon={faMinus} />
    </button>);

const ZoomInButton = ({ disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px', marginLeft: '0px' }} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon icon={faPlus} />
    </button>);

export default class PinchZoomPan extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseWheel = this.handleMouseWheel.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
    }

    //event handlers
    handleTouchStart(event) {
        this.animation && cancelAnimationFrame(this.animation);

        const touches = event.touches;
        if (touches.length === 2) {
            this.pinchStart(touches);
        }
        else if (touches.length === 1) {
            this.pointerDown(touches[0]);

            if (this.state.top < 0) {
                //suppress pull-down-refresh since there is room to pan up on the image
                event.preventDefault();
            }
        }
    }

    handleTouchMove(event) {
        const touches = event.touches;
        if (touches.length === 2) {
            //suppress viewport scaling
            event.preventDefault();
            this.pinchChange(touches);
        }
        else if (touches.length === 1) {
            this.pan(touches[0]);
        }
    }

    handleTouchEnd(event) {
        if (event.touches && event.touches.length > 0) return null;

        //We allow transient +/-5% over-pinching.
        //Animate the bounce back to constraints if applicable.
        this.ensureValidTransform(ANIMATION_SPEED);

        this.pointerUp(event.timeStamp);

        //suppress mouseUp, in case of tap
        event.preventDefault();
    }

    handleMouseDown(event) {
        this.animation && cancelAnimationFrame(this.animation);
        this.mouseDown = true;
        this.pointerDown(event);
    }

    handleMouseMove(event) {
        if (!this.mouseDown) return null;
        this.pan(event)
    }

    handleMouseUp(event) {
        this.pointerUp(event.timeStamp);
        if (this.mouseDown) {
            this.mouseDown = false;
        }
    }

    handleMouseWheel(event) {
        this.animation && cancelAnimationFrame(this.animation);
        const point = getRelativePosition(event, this.container);
        if (event.deltaY > 0) {
            if (this.state.scale > this.minScale) {
                this.zoomOut(point);
                event.preventDefault();
            }
        } else if (event.deltaY < 0) {
            if (this.state.scale < this.props.maxScale) {
                this.zoomIn(point);
                event.preventDefault();
            }
        }
    }

    handleWindowResize(event) {
        this.forceUpdate();
    }

    //actions
    pointerDown(clientPosition) {
        this.lastPanPointerPosition = getRelativePosition(clientPosition, this.container);
    }

    pan(pointerClientPosition) {
        const pointerPosition = getRelativePosition(pointerClientPosition, this.container);
        const translateX = pointerPosition.x - this.lastPanPointerPosition.x;
        const translateY = pointerPosition.y - this.lastPanPointerPosition.y;
        const top = this.state.top + translateY;
        const left = this.state.left + translateX;

        //prevent over-panning with 0 tolerance; over-panning doesn't look good
        this.move(top, left, 0)
        this.lastPanPointerPosition = pointerPosition;
    }

    pointerUp(timeStamp) {
        if (this.lastPointerUpTimeStamp && this.lastPointerUpTimeStamp + DOUBLE_TAP_THRESHOLD > timeStamp) {
            //reset
            this.transformToProps(ANIMATION_SPEED);
        }

        this.lastPointerUpTimeStamp = timeStamp;
    }

    move(top, left, tolerance, speed = 0) {
        this.applyTransform(top, left, this.state.scale, tolerance, speed);
    }

    pinchStart(touches) {
        const pointA = getRelativePosition(touches[0], this.container);
        const pointB = getRelativePosition(touches[1], this.container);
        this.lastPinchLength = getDistanceBetweenPoints(pointA, pointB);
    }

    pinchChange(touches) {
        const pointA = getRelativePosition(touches[0], this.container);
        const pointB = getRelativePosition(touches[1], this.container);
        const length = getDistanceBetweenPoints(pointA, pointB);
        const scale = this.state.scale * length / this.lastPinchLength;
        const midpoint = getMidpoint(pointA, pointB);

        this.zoom(scale, midpoint, OVER_TRANSFORMATION_TOLERANCE);

        this.lastPinchMidpoint = midpoint;
        this.lastPinchLength = length;
    }

    zoomIn(midpoint) {
        midpoint = midpoint || {
            x: this.container.offsetWidth / 2,
            y: this.container.offsetHeight / 2
        };
        this.zoom(this.state.scale * 1.05, midpoint, 0);
    }

    zoomOut(midpoint) {
        midpoint = midpoint || {
            x: this.container.offsetWidth / 2,
            y: this.container.offsetHeight / 2
        };
        this.zoom(this.state.scale * 0.95, midpoint, 0);
    }

    zoom(scale, midpoint, tolerance, speed = 0) {
        scale = this.getValidTransform(0, 0, scale, tolerance).scale;

        const incrementalScalePercentage = (this.state.scale - scale) / this.state.scale;
        const translateY = (midpoint.y - this.state.top) * incrementalScalePercentage;
        const translateX = (midpoint.x - this.state.left) * incrementalScalePercentage;

        const top = this.state.top + translateY;
        const left = this.state.left + translateX;

        this.applyTransform(top, left, scale, tolerance, speed);
    }

    //state validation and transformation methods
    applyTransform(requestedTop, requestedLeft, requestedScale, tolerance, speed = 0) {
        const { top, left, scale } = this.getValidTransform(requestedTop, requestedLeft, requestedScale, tolerance);

        if (this.state.scale === scale &&
            this.state.top === top &&
            this.state.left === left) {
            return;
        }

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

                this.setState(nextTransform, () => this.animation = requestAnimationFrame(frame));
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

    getValidTransform(top, left, scale, tolerance) {
        const transform = {
            scale: scale || 1,
            top: top || 0,
            left: left || 0,
        };
        const lowerBoundFactor = 1.0 - tolerance;
        const upperBoundFactor = 1.0 + tolerance;

        transform.scale = rangeBind(this.minScale * lowerBoundFactor,
            this.props.maxScale * upperBoundFactor,
            transform.scale);

        //get dimensions by which scaled image overflows container
        const negativeSpace = this.calculateNegativeSpace(transform.scale);
        const overflow = {
            width: Math.max(0, invert(negativeSpace.width)),
            height: Math.max(0, invert(negativeSpace.height)),
        };

        //prevent moving by more than the overflow
        //example: overflow.height = 100, tolerance = 0.05 => top is constrained between -105 and +5
        transform.top = rangeBind(invert(overflow.height) * upperBoundFactor, overflow.height * upperBoundFactor - overflow.height, transform.top);
        transform.left = rangeBind(invert(overflow.width) * upperBoundFactor, overflow.width * upperBoundFactor - overflow.width, transform.left);

        return transform;
    }

    transformToProps(speed = 0) {
        const scale = this.props.initialScale === 'auto' ? this.calculateAutofitScale() : this.props.initialScale;
        this.applyTransform(this.props.initialTop, this.props.initialLeft, scale, 0, speed);
    }

    ensureValidTransform(speed = 0) {
        this.applyTransform(this.state.top, this.state.left, this.state.scale, 0, speed);
    }

    //lifecycle methods
    render() {
        const childElement = React.Children.only(this.props.children);
        const { ref: originalRef } = childElement;
        const composedRef = element => {
            this.image = element;
            if (typeof originalRef === 'function') {
                originalRef(element);
            }
        };
        return (
            <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
                {this.props.zoomButtons && (
                    <div style={{ position: 'absolute', zIndex: 1000 }}>
                        <ZoomOutButton onClick={() => this.zoomOut()} disabled={this.state.scale <= this.minScale} />
                        <ZoomInButton onClick={() => this.zoomIn()} disabled={this.state.scale >= this.props.maxScale} />
                    </div>
                )}
                {React.cloneElement(childElement, {
                    onTouchStart: this.handleTouchStart,
                    onTouchEnd: this.handleTouchEnd,
                    onMouseDown: this.handleMouseDown,
                    onMouseMove: this.handleMouseMove,
                    onMouseUp: this.handleMouseUp,
                    onWheel: this.handleMouseWheel,
                    onDragStart: event => event.preventDefault(),
                    ref: composedRef,
                    style: {
                        cursor: 'pointer',
                        transform: `translate3d(${this.state.left}px, ${this.state.top}px, 0) scale(${this.state.scale})`,
                        transformOrigin: '0 0',
                    },
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
        this.image.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        window.addEventListener("resize", this.handleWindowResize);

        //Using the child image's original parent enables flex items, e.g., dimensions not explicitly set
        this.container = this.image.parentNode.parentNode; 
        if (this.image.offsetWidth && this.image.offsetHeight) {
            this.applyConstraints();
            this.transformToProps();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.image.offsetWidth && this.image.offsetHeight) {
            const negativeSpace = this.calculateNegativeSpace(1);
            if (!this.lastUnzoomedNegativeSpace ||
                negativeSpace.height !== this.lastUnzoomedNegativeSpace.height ||
                negativeSpace.width !== this.lastUnzoomedNegativeSpace.width) {
                //image and/or container dimensions have been set / updated
                this.applyConstraints();
            }

            if (typeof this.state.scale === 'undefined') {
                //reset to new props
                this.transformToProps();
            }
        }
    }

    componentWillUnmount() {
        this.image.removeEventListener('touchmove', this.handleTouchMove);
        window.removeEventListener('resize', this.handleWindowResize);
    }

    //helper methods
    applyConstraints() {
        let minScale = 1;
        if (this.props.minScale === 'auto') {
            minScale = this.calculateAutofitScale();
        } else {
            minScale = this.props.minScale;
        }

        if (this.minScale !== minScale) {
            this.minScale = minScale;
            this.ensureValidTransform();
        }

        this.lastUnzoomedNegativeSpace = this.calculateNegativeSpace(1);
    }

    calculateNegativeSpace(scale = this.state.scale) {
        //get difference in dimension between container and scaled image
        const width = this.container.offsetWidth - (scale * this.image.offsetWidth);
        const height = this.container.offsetHeight - (scale * this.image.offsetHeight);
        return {
            width,
            height
        };
    }

    calculateAutofitScale() {
        let autofitScale = 1;
        if (this.image.offsetWidth > 0) {
            autofitScale = Math.min(this.container.offsetWidth / this.image.offsetWidth, autofitScale)
        }
        if (this.image.offsetHeight > 0) {
            autofitScale = Math.min(this.container.offsetHeight / this.image.offsetHeight, autofitScale);
        }
        return autofitScale;
    }
}

PinchZoomPan.defaultProps = {
    initialTop: 0,
    initialLeft: 0,
    initialScale: 'auto',
    minScale: 'auto',
    maxScale: 1,
    zoomButtons: true,
};

PinchZoomPan.propTypes = {
    children: PropTypes.element.isRequired
};
