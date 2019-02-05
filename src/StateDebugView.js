import React from 'react';

const style = {
    position: 'absolute',
    marginTop: '40px',
    marginLeft: '5px',
    backgroundColor: 'rgba(0,0,0,0)',
    zIndex: '1000',
    color: 'white',
}
export default ({ top, left, scale, overflow }) => {
    const overflowDisplay = [
        overflow.top > 0 ? 'top' : '',
        overflow.right > 0 ? 'right': '',
        overflow.bottom > 0 ? 'bottom' : '',
        overflow.left > 0 ? 'left' : '',
    ]
        .filter(o => o.length)
        .join(', ') || 
        'none';
    return (
        <div style={style}>
            <div>{`top: ${top}`}</div>
            <div>{`left: ${left}`}</div>
            <div>{`scale: ${scale}`}</div>
            <div>{`overflow: ${overflowDisplay}`}</div>
        </div>
    );
}
