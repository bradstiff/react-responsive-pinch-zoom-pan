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

export const getMidpoint = (pointA, pointB) => ({
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
});

export const getDistanceBetweenPoints = (pointA, pointB) => (
    Math.sqrt(Math.pow(pointA.y - pointB.y, 2) + Math.pow(pointA.x - pointB.x, 2))
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
    return dimensions1.offsetWidth === dimensions2.offsetWidth &&
        dimensions1.offsetHeight === dimensions2.offsetHeight;
}

export const getDimensions = object => {
    if (object === undefined) {
        return undefined;
    }
    return {
        offsetWidth: object.offsetWidth,
        offsetHeight: object.offsetHeight,
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
    const { offsetWidth: imageWidth, offsetHeight: imageHeight } = imageDimensions || {};
    if (! (imageWidth > 0 && imageHeight > 0) ) {
        return 1;
    }
    return Math.min(
        containerDimensions.offsetWidth / imageWidth,
        containerDimensions.offsetHeight / imageHeight,
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