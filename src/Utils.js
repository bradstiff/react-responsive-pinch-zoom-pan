export const snapToTarget = (value, target, tolerance) => {
    const withinRange = Math.abs(target - value) < tolerance;
    return withinRange ? target : value;
};

export const rangeBind = (lowerBound, upperBound, value) => Math.min(upperBound, Math.max(lowerBound, value));

export const invert = (value) => value * -1;

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

