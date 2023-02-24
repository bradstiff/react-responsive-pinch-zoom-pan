import { Inset } from "./types/Inset"
import { Transform } from "./types/Transform"
import { ClientPosition } from "./types/ClientPosition"
import { Dimensions } from "./types/Dimensions"
import { Position } from "./types/Position"

export const constrain = (
  lowerBound: number,
  upperBound: number,
  value: number
) => Math.min(upperBound, Math.max(lowerBound, value))

export const negate = (value: number) => value * -1

export const getRelativePosition = (
  position: ClientPosition,
  relativeToElement?: HTMLElement | null
): Position | undefined => {
  if (!relativeToElement) return undefined
  const rect = relativeToElement.getBoundingClientRect()
  return {
    x: position.clientX - rect.left,
    y: position.clientY - rect.top,
  }
}

export const getPinchMidpoint = (touches: React.TouchList) => ({
  x: (touches.item(0).clientX + touches.item(1).clientX) / 2,
  y: (touches.item(0).clientY + touches.item(1).clientY) / 2,
})

export const getPinchLength = (touches: React.TouchList) =>
  Math.sqrt(
    Math.pow(touches.item(0).clientY - touches.item(1).clientY, 2) +
      Math.pow(touches.item(0).clientX - touches.item(1).clientX, 2)
  )

export const getDimensions = (
  object?: HTMLImageElement | null
): Dimensions | undefined => {
  if (!object) return undefined

  return {
    width: object.offsetWidth || object.width,
    height: object.offsetHeight || object.height,
  }
}

export const getContainerDimensions = (
  object?: HTMLDivElement | null
): Dimensions | undefined => {
  if (!object) return undefined

  return {
    width: object.offsetWidth,
    height: object.offsetHeight,
  }
}

export const isEqualTransform = (
  transform1?: Transform,
  transform2?: Transform
) => {
  if ((transform1 === transform2) === undefined) {
    return true
  }
  if (transform1 === undefined || transform2 === undefined) {
    return false
  }
  return (
    round(transform1.top, 5) === round(transform2.top, 5) &&
    round(transform1.left, 5) === round(transform2.left, 5) &&
    round(transform1.scale, 5) === round(transform2.scale, 5)
  )
}

export const getAutofitScale = (
  containerDimensions: Dimensions = { height: 0, width: 0 },
  imageDimensions: Dimensions = { height: 0, width: 0 }
) => {
  const { width: imageWidth, height: imageHeight } = imageDimensions
  if (!(imageWidth > 0 && imageHeight > 0)) {
    return 1
  }
  return Math.min(
    containerDimensions.width / imageWidth,
    containerDimensions.height / imageHeight,
    1
  )
}

function round(number: number, precision: number) {
  if (precision && number !== null && number !== undefined) {
    // Shift with exponential notation to avoid floating-point issues.
    // See [MDN](https://mdn.io/round#Examples) for more details.
    var pair = (String(number) + 'e').split('e')
    var value = Math.round(Number(pair[0] + 'e' + (pair[1] + precision)))
    pair = (String(value) + 'e').split('e')
    return +(pair[0] + 'e' + (+pair[1] - precision))
  }
  return Math.round(number)
}

export const tryCancelEvent = (event: React.MouseEvent | React.TouchEvent) => {
  if (event.cancelable === false) {
    return false
  }

  event.preventDefault()
  return true
}

function calculateOverflowLeft(left: number) {
  const overflow = negate(left)
  return overflow > 0 ? overflow : 0
}

function calculateOverflowTop(top: number) {
  const overflow = negate(top)
  return overflow > 0 ? overflow : 0
}

function calculateOverflowRight(
  left: number,
  scale: number,
  imageDimensions: Dimensions,
  containerDimensions: Dimensions
) {
  const overflow = Math.max(
    0,
    scale * imageDimensions.width - containerDimensions.width
  )
  return overflow > 0 ? overflow - negate(left) : 0
}

function calculateOverflowBottom(
  top: number,
  scale: number,
  imageDimensions: Dimensions,
  containerDimensions: Dimensions
) {
  const overflow = Math.max(
    0,
    scale * imageDimensions.height - containerDimensions.height
  )
  return overflow > 0 ? overflow - negate(top) : 0
}

export const getImageOverflow = (
  top: number,
  left: number,
  scale: number,
  imageDimensions: Dimensions,
  containerDimensions: Dimensions
): Inset => {
  return {
    top: calculateOverflowTop(top),
    right: calculateOverflowRight(
      left,
      scale,
      imageDimensions,
      containerDimensions
    ),
    bottom: calculateOverflowBottom(
      top,
      scale,
      imageDimensions,
      containerDimensions
    ),
    left: calculateOverflowLeft(left),
  }
}
