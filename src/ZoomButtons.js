import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';

import './styles.css';
import { faHandPaper } from '@fortawesome/free-solid-svg-icons/faHandPaper';

const containerStyle = { 
    position: 'absolute', 
    zIndex: 1000 
};

const ZoomOutButton = ({ disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px' }} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon icon={faMinus} fixedWidth />
    </button>
);

const ZoomInButton = ({ disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px', marginLeft: '0px' }} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon icon={faPlus} fixedWidth />
    </button>
);

const DragButton = ({ active, disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px', marginLeft: '0px'}} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon color={ active? '#3F78AD': '#000000' } icon={faHandPaper} fixedWidth />
    </button>
);

const ZoomButtons = ({scale, minScale, maxScale, onZoomInClick, onZoomOutClick,isImageMoveable,toggleImageMove}) => (
    <div style={containerStyle}>
        <ZoomOutButton onClick={onZoomOutClick} disabled={scale <= minScale} />
        <ZoomInButton onClick={onZoomInClick} disabled={scale >= maxScale} />
        <DragButton active={isImageMoveable} onClick={toggleImageMove} />
    </div>
);

ZoomButtons.propTypes = {
    scale: PropTypes.number.isRequired,
    minScale: PropTypes.number.isRequired,
    maxScale: PropTypes.number.isRequired,
    onZoomInClick: PropTypes.func.isRequired,
    onZoomOutClick: PropTypes.func.isRequired,
    toggleImageMove: PropTypes.func.isRequired,
    isImageMoveable: PropTypes.bool,
};

export default ZoomButtons;