import React, {
  CSSProperties,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  negate,
  constrain,
  getPinchLength,
  getPinchMidpoint,
  getRelativePosition,
  getDimensions,
  getContainerDimensions,
  isEqualTransform,
  getAutofitScale,
  tryCancelEvent,
  getImageOverflow,
} from './Utils'
import { Transform } from "./types/Transform"
import { ClientPosition } from "./types/ClientPosition"
import { Position } from './types/Position'

const OVERZOOM_TOLERANCE = 0.05
const DOUBLE_TAP_THRESHOLD = 250

interface PinchZoomPanImageProps {
  initialScale?: number | 'auto'
  minScale?: number | 'auto'
  maxScale?: number
  position?: 'topLeft' | 'center'
  animate?: boolean
  doubleTapBehavior?: 'reset' | 'zoom'
  initialTop?: number
  initialLeft?: number
  style?: CSSProperties
  src: string
  alt?: string
}

export function PinchZoomPanImage(props: PinchZoomPanImageProps): JSX.Element {
  const {
    doubleTapBehavior = 'reset',
    initialLeft,
    initialScale = 'auto',
    initialTop,
    maxScale = 1,
    minScale = 'auto',
    position = 'center',
    style = {},
    src,
    animate,
    alt=''
  } = props

  // enables detecting double-tap
  const [lastPointerUpTimeStamp, setLastPointerUpTimeStamp] = useState<
    number | undefined
  >()
  // helps determine how far to pan the image
  const [lastPanPointerPosition, setLastPanPointerPosition] = useState<
    Position | undefined
  >()
  // helps determine if we are pinching in or out
  const [lastPinchLength, setLastPinchLength] = useState<number | undefined>()
  // image element
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerElement = containerRef.current
  const imageElement = imageRef.current
  // permits initial transform
  const [isImageLoaded, setImageLoaded] = useState<boolean>()

  const [top, setTop] = useState<number | undefined>()
  const [left, setLeft] = useState<number | undefined>()
  const [scale, setScale] = useState<number | undefined>()


  useEffect(() => {
    if (!isImageLoaded) return
    maybeHandleDimensionsChanged()
  }, [isImageLoaded])

  const imageDimensions = getDimensions(imageElement)
  const containerDimensions = getContainerDimensions(containerElement)

  const isInitialized =
    scale !== undefined &&
    left !== undefined &&
    top !== undefined &&
    imageDimensions !== undefined &&
    containerDimensions !== undefined

  const isImageReady =
    isImageLoaded ?? Boolean(imageElement && imageElement.tagName !== 'IMG')

  const imageOverflow = isInitialized
    ? getImageOverflow(top, left, scale, imageDimensions, containerDimensions)
    : undefined

  console.log(isImageReady)

  const imageStyle: CSSProperties = isInitialized
    ? {
      ...(style),
      transition: animate ? 'all 0.15s ease-out' : undefined,
      transform: `translate3d(${left}px, ${top}px, 0) scale(${scale})`,
      transformOrigin: '0 0',
    }
    : style

  // Determine the panning directions where there is no image overflow and let
  // the browser handle those directions (e.g., scroll viewport if possible).
  // Need to replace 'pan-left pan-right' with 'pan-x', etc. otherwise
  // it is rejected (o_O), therefore explicitly handle each combination.
  const browserPanX = imageOverflow
    ? !imageOverflow.left && !imageOverflow.right
      ? 'pan-x' // we can't pan the image horizontally, let the browser take it
      : !imageOverflow.left
        ? 'pan-left'
        : !imageOverflow.right
          ? 'pan-right'
          : ''
    : ''
  const browserPanY = imageOverflow
    ? !imageOverflow.top && !imageOverflow.bottom
      ? 'pan-y'
      : !imageOverflow.top
        ? 'pan-up'
        : !imageOverflow.bottom
          ? 'pan-down'
          : ''
    : ''

  // event handlers
  const handleTouchStart = (event: React.TouchEvent) => {
    const touches = event.touches
    if (touches.length === 2) {
      setLastPinchLength(getPinchLength(touches))
      setLastPanPointerPosition(undefined)
    } else if (touches.length === 1) {
      setLastPinchLength(undefined)
      pointerDown(touches[0])
      tryCancelEvent(event) // suppress mouse events
    }
  }

  // const handleTouchMove = (event: React.TouchEvent) => {
  //   const touches = event.touches
  //   if (touches.length === 2) {
  //     pinchChange(touches)

  //     // suppress viewport scaling on iOS
  //     tryCancelEvent(event)
  //   } else if (touches.length === 1) {
  //     const requestedPan = pan(touches[0])

  //     if (requestedPan && !controlOverscrollViaCss) {
  //       // let the browser handling panning if we are at the edge of the image in
  //       // both pan directions, or if we are primarily panning in one direction
  //       // and are at the edge in that directino
  //       const overflow = imageOverflow
  //       if (!overflow) return
  //       const hasOverflowX =
  //         (requestedPan.left && overflow.left > 0) ||
  //         (requestedPan.right && overflow.right > 0)
  //       const hasOverflowY =
  //         (requestedPan.up && overflow.top > 0) ||
  //         (requestedPan.down && overflow.bottom > 0)

  //       if (!hasOverflowX && !hasOverflowY) {
  //         // no overflow in both directions
  //         return
  //       }

  //       const panX = requestedPan.left || requestedPan.right
  //       const panY = requestedPan.up || requestedPan.down
  //       if (panY > 2 * panX && !hasOverflowY) {
  //         // primarily panning up or down and no overflow in the Y direction
  //         return
  //       }

  //       if (panX > 2 * panY && !hasOverflowX) {
  //         // primarily panning left or right and no overflow in the X direction
  //         return
  //       }

  //       tryCancelEvent(event)
  //     }
  //   }
  // }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length === 0 && event.changedTouches.length === 1) {
      if (
        lastPointerUpTimeStamp &&
        lastPointerUpTimeStamp + DOUBLE_TAP_THRESHOLD > event.timeStamp
      ) {
        const pointerPosition = getRelativePosition(
          event.changedTouches[0],
          containerElement
        )
        doubleClick(pointerPosition)
      }
      setLastPointerUpTimeStamp(event.timeStamp)
      tryCancelEvent(event) // suppress mouse events
    }

    // We allow transient +/-5% over-pinching.
    maybeAdjustCurrentTransform()
    return
  }

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button === 0)
      pointerDown(event)
    else if (event.button === 1)
      applyInitialTransform()
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!event.buttons) return null
    pan(event)
  }

  const handleMouseDoubleClick = (event: React.MouseEvent) => {
    var pointerPosition = getRelativePosition(event, containerElement)
    doubleClick(pointerPosition)
  }

  const sanitizedMinScale =
    minScale === 'auto'
      ? getAutofitScale(containerDimensions, imageDimensions)
      : minScale ?? 1

  const handleMouseWheel = (event: React.WheelEvent) => {
    if (!isInitialized) return

    const point = getRelativePosition(event, containerElement)
    if (event.deltaY > 0) {
      if (scale > sanitizedMinScale) {
        zoomOut(point)
        tryCancelEvent(event)
      }
    } else if (event.deltaY < 0) {
      if (scale < maxScale) {
        zoomIn(point)
        tryCancelEvent(event)
      }
    }
  }

  const handleImageLoad = (event: any) => {
    setImageLoaded(true)
    maybeHandleDimensionsChanged()
  }

  const handleWindowResize = () => maybeHandleDimensionsChanged()

  // actions
  const pointerDown = (clientPosition: ClientPosition) => {
    const p = getRelativePosition(clientPosition, containerElement)
    setLastPanPointerPosition(p)
  }

  const pan = (pointerClientPosition: ClientPosition) => {
    if (!isInitialized) return

    if (!lastPanPointerPosition) {
      // if we were pinching and lifted a finger
      pointerDown(pointerClientPosition)
      return 0
    }

    const pointerPosition = getRelativePosition(
      pointerClientPosition,
      containerElement
    )

    if (!pointerPosition) return

    const translateX = pointerPosition.x - lastPanPointerPosition.x
    const translateY = pointerPosition.y - lastPanPointerPosition.y
    setLastPanPointerPosition(pointerPosition)

    constrainAndApplyTransform(
      (top ?? 0) + translateY,
      (left ?? 0) + translateX,
      scale,
      0
    )

    return {
      up: translateY > 0 ? translateY : 0,
      down: translateY < 0 ? negate(translateY) : 0,
      right: translateX < 0 ? negate(translateX) : 0,
      left: translateX > 0 ? translateX : 0,
    }
  }

  const doubleClick = (pointerPosition?: Position) => {
    if (!isInitialized) return
    if (
      doubleTapBehavior === 'zoom' &&
      scale * (1 + OVERZOOM_TOLERANCE) < maxScale
    ) {
      zoomIn(pointerPosition, 0.3)
    } else {
      // reset
      applyInitialTransform()
    }
  }

  const pinchChange = (touches: React.TouchList) => {
    if (!isInitialized) return
    const length = getPinchLength(touches)
    const midpoint = getPinchMidpoint(touches)
    const newScale = lastPinchLength
      ? (scale * length) / lastPinchLength // sometimes we get a touchchange before a touchstart when pinching
      : scale

    zoom(newScale, midpoint, OVERZOOM_TOLERANCE)

    setLastPinchLength(length)
  }

  const zoomIn = (midpoint?: Position, factor = 0.1) => {
    if (!isInitialized) return
    midpoint = midpoint ?? {
      x: containerDimensions.width / 2,
      y: containerDimensions.height / 2,
    }
    zoom(scale * (1 + factor), midpoint, 0)
  }

  const zoomOut = (midpoint?: Position) => {
    if (!isInitialized) return
    midpoint = midpoint ?? {
      x: containerDimensions.width / 2,
      y: containerDimensions.height / 2,
    }
    zoom(scale * 0.9, midpoint, 0)
  }

  const zoom = (
    requestedScale: number,
    containerRelativePoint: Position,
    tolerance: number
  ) => {
    if (!isInitialized) return

    const imageRelativePoint = {
      top: containerRelativePoint.y - top,
      left: containerRelativePoint.x - left,
    }

    const nextScale = getConstrainedScale(requestedScale, tolerance)
    const incrementalScalePercentage = (nextScale - scale) / scale
    const translateY = imageRelativePoint.top * incrementalScalePercentage
    const translateX = imageRelativePoint.left * incrementalScalePercentage

    const nextTop = top - translateY
    const nextLeft = left - translateX

    constrainAndApplyTransform(nextTop, nextLeft, nextScale, tolerance)
  }

  const maybeHandleDimensionsChanged = () => {
    if (!isImageReady) return
    if (isInitialized) {
      maybeAdjustCurrentTransform()
    } else {
      applyInitialTransform()
    }
  }

  // transformation methods

  // Zooming and panning cause transform to be requested.
  const constrainAndApplyTransform = (
    requestedTop: number,
    requestedLeft: number,
    requestedScale: number,
    tolerance: number
  ) => {

    const requestedTransform = {
      top: requestedTop,
      left: requestedLeft,
      scale: requestedScale,
    }

    // Correct the transform if needed to prevent overpanning and overzooming
    const transform =
      getCorrectedTransform(requestedTransform, tolerance) || requestedTransform

    if (isInitialized && isEqualTransform(transform, { top, left, scale })) {
      return false
    }

    applyTransform(transform)
    return true
  }

  const applyTransform = (transform: Transform) => {
    const { top: tTop, left: tLeft, scale: tScale } = transform

    setTop(tTop)
    setLeft(tLeft)
    setScale(tScale)
  }

  // Returns constrained scale when requested scale is outside min/max with tolerance, otherwise returns requested scale
  const getConstrainedScale = (requestedScale: number, tolerance: number) => {
    const lowerBoundFactor = 1.0 - tolerance
    const upperBoundFactor = 1.0 + tolerance

    return constrain(
      sanitizedMinScale * lowerBoundFactor,
      maxScale * upperBoundFactor,
      requestedScale
    )
  }

  // Returns constrained transform when requested transform is outside constraints with tolerance, otherwise returns null
  const getCorrectedTransform = (
    requestedTransform: Transform,
    tolerance: number
  ) => {
    if (!containerDimensions) return
    if (!imageDimensions) return
    const scale = getConstrainedScale(requestedTransform.scale, tolerance)

    // get dimensions by which scaled image overflows container
    const negativeSpace = calculateNegativeSpace(scale)
    const overflow = {
      width: Math.max(0, negate(negativeSpace?.width ?? 0)),
      height: Math.max(0, negate(negativeSpace?.height ?? 0)),
    }

    // if image overflows container, prevent moving by more than the overflow
    // example: overflow.height = 100, tolerance = 0.05 => top is constrained between -105 and +5
    const { position, initialTop, initialLeft } = props

    const upperBoundFactor = 1.0 + tolerance
    const top = overflow.height
      ? constrain(
        negate(overflow.height) * upperBoundFactor,
        overflow.height * upperBoundFactor - overflow.height,
        requestedTransform.top
      )
      : position === 'center'
        ? (containerDimensions.height - imageDimensions.height * scale) / 2
        : (initialTop ?? 0)

    const left = overflow.width
      ? constrain(
        negate(overflow.width) * upperBoundFactor,
        overflow.width * upperBoundFactor - overflow.width,
        requestedTransform.left
      )
      : position === 'center'
        ? (containerDimensions.width - imageDimensions.width * scale) / 2
        : (initialLeft ?? 0)

    const constrainedTransform = {
      top,
      left,
      scale,
    }

    return isEqualTransform(constrainedTransform, requestedTransform)
      ? null
      : constrainedTransform
  }

  // Ensure current transform is within constraints
  const maybeAdjustCurrentTransform = () => {
    if (!isInitialized) return
    let correctedTransform
    if ((correctedTransform = getCorrectedTransform({ top, left, scale }, 0))) {
      applyTransform(correctedTransform)
    }
  }

  const applyInitialTransform = () => {
    if (!containerDimensions) return
    if (!imageDimensions) return

    const newScale =
      initialScale === 'auto'
        ? getAutofitScale(containerDimensions, imageDimensions)
        : initialScale
    const minScale = sanitizedMinScale

    if (minScale > maxScale) {
      console.warn('minScale cannot exceed maxScale.')
      return
    }
    if (newScale < minScale || newScale > maxScale) {
      console.warn('initialScale must be between minScale and maxScale.')
      return
    }

    let initialPosition
    if (position === 'center') {
      if (initialTop !== undefined)
        console.warn(
          'initialTop prop should not be supplied with position=center. It was ignored.'
        )
      if (initialLeft !== undefined)
        console.warn(
          'initialLeft prop should not be supplied with position=center. It was ignored.'
        )
      initialPosition = {
        top: (containerDimensions.width - imageDimensions.width * newScale) / 2,
        left:
          (containerDimensions.height - imageDimensions.height * newScale) / 2,
      }
    } else {
      initialPosition = {
        top: initialTop ?? 0,
        left: initialLeft ?? 0,
      }
    }
    constrainAndApplyTransform(
      initialPosition.top,
      initialPosition.left,
      newScale,
      0
    )
  }

  const controlOverscrollViaCss =
    window.CSS && window.CSS.supports('touch-action', 'pan-up')
  const browserPanActions =
    browserPanX.length > 0 || browserPanY.length > 0
      ? [browserPanX, browserPanY].join(' ').trim()
      : 'none'

  const touchAction = controlOverscrollViaCss ? browserPanActions : undefined

  const containerStyle = {
    ...props.style,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    touchAction: touchAction,
  }

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize)
    maybeHandleDimensionsChanged()
    return () => {
      //  imageRef?.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [])


  const calculateNegativeSpace = (scale: number) => {
    if (!isInitialized) return
    // get difference in dimension between container and scaled image
    const width = containerDimensions.width - scale * imageDimensions.width
    const height = containerDimensions.height - scale * imageDimensions.height
    return {
      width,
      height,
    }
  }


  return (
    <div style={containerStyle} ref={containerRef}>
      <img
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleMouseDoubleClick}
        onWheel={handleMouseWheel}
        onDragStart={tryCancelEvent}
        onLoad={handleImageLoad}
        onContextMenu={tryCancelEvent}
        style={imageStyle}
        ref={imageRef}
        src={src}
        alt={alt}
      />
    </div>
  )
}
