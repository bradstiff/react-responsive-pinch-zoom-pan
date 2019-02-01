import { createSelector } from 'reselect';

export const snapToTarget = (value, target, tolerance) => {
    const withinRange = Math.abs(target - value) < tolerance;
    return withinRange ? target : value;
};

export const constrain = (lowerBound, upperBound, value) => Math.min(upperBound, Math.max(lowerBound, value));

export const negate = (value) => value * -1;

export const getRelativePosition = ({ clientX, clientY }, relativeToElement) => {
    const rect = relativeToElement.getBoundingClientRect();
    return {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
};

export const getPinchMidpoint = ([touch1, touch2]) => ({
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
});

export const getPinchLength = ([touch1, touch2]) => (
    Math.sqrt(Math.pow(touch1.clientY - touch2.clientY, 2) + Math.pow(touch1.clientX - touch2.clientX, 2))
);

export function setRef(ref, value) {
    if (typeof ref === 'function') {
      ref(value);
    } else if (ref) {
      ref.current = value;
    }
};

export const isEqualDimensions = (dimensions1, dimensions2) => {
    if (dimensions1 === dimensions2 === undefined) {
        return true;
    }
    if (dimensions1 === undefined || dimensions2 === undefined) {
        return false;
    }
    return dimensions1.width === dimensions2.width &&
        dimensions1.height === dimensions2.height;
}

export const getDimensions = object => {
    if (object === undefined) {
        return undefined;
    }
    return {
        width: object.width,
        height: object.height,
    };
}

export const getContainerDimensions = image => {
    return {
        width: image.parentNode.offsetWidth,
        height: image.parentNode.offsetHeight,
    };
}

export const isEqualTransform = (transform1, transform2) => {
    if (transform1 === transform2 === undefined) {
        return true;
    }
    if (transform1 === undefined || transform2 === undefined) {
        return false;
    }
    return round(transform1.top, 5) === round(transform2.top, 5) && 
        round(transform1.left, 5) === round(transform2.left, 5) && 
        round(transform1.scale, 5) === round(transform2.scale, 5);
}

const calculateAutofitScale = (containerDimensions, imageDimensions) => {
    const { width: imageWidth, height: imageHeight } = imageDimensions || {};
    if (! (imageWidth > 0 && imageHeight > 0) ) {
        return 1;
    }
    return Math.min(
        containerDimensions.width / imageWidth,
        containerDimensions.height / imageHeight,
        1
    );
}

export const getMinScale = createSelector(
    state => state.containerDimensions,
    state => state.imageDimensions,
    (state, props) => props.minScale,
    (containerDimensions, imageDimensions, minScaleProp) => 
        minScaleProp === 'auto'
            ? calculateAutofitScale(containerDimensions, imageDimensions)
            : minScaleProp || 1
)

function round(number, precision) {
    if (precision && number !== null && number !== undefined) {
      // Shift with exponential notation to avoid floating-point issues.
      // See [MDN](https://mdn.io/round#Examples) for more details.
      var pair = (String(number) + 'e').split('e'),
          value = Math.round(pair[0] + 'e' + (+pair[1] + precision));

      pair = (String(value) + 'e').split('e');
      return +(pair[0] + 'e' + (+pair[1] - precision));
    }
    return Math.round(number);
};

export function debug(message) {
    if (process.env.NODE_ENV !== 'production') {    
        console.log(message);
    }
}