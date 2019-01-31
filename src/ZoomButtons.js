import React from 'react';
import PropTypes from 'prop-types';

import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faPlus from '@fortawesome/fontawesome-free-solid/faPlus';
import faMinus from '@fortawesome/fontawesome-free-solid/faMinus';

import './styles.css';

export const ZoomOutButton = ({ disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px' }} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon icon={faMinus} />
    </button>
);

ZoomOutButton.defaultProps = {
    disabled: false
}

ZoomOutButton.propTypes = {
    onClick: PropTypes.func.isRequired
}

export const ZoomInButton = ({ disabled, onClick }) => (
    <button className='iconButton' style={{ margin: '10px', marginLeft: '0px' }} onClick={onClick} disabled={disabled}>
        <FontAwesomeIcon icon={faPlus} />
    </button>
);

ZoomInButton.defaultProps = {
    disabled: false
}

ZoomInButton.propTypes = {
    onClick: PropTypes.func.isRequired
}
