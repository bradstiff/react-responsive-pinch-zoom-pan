import React from "react";
import { render } from "react-dom";
import PinchZoomPan from "../../src/PinchZoomPan";

const isDevelopment = () => process.env.NODE_ENV !== 'production';

const SizedContainerView = ({menu, width, height}) => {
    const imageWidth = width * 2;
    const imageHeight = height * 2;
    return (
        <div>
            <nav>{menu}</nav>
            <main style={{ width: `${width}px`, height: `${height}px` }}>
                <PinchZoomPan doubleTapBehavior='zoom' debug={isDevelopment()}>
                    <img alt='Demo Image' src={`http://picsum.photos/${imageWidth}/${imageHeight}?random`} />
                </PinchZoomPan>
            </main>
        </div>
    );
}

const CenteredView = ({menu, width, height, imageWidth, imageHeight}) => {
    return (
        <div>
            <nav>{menu}</nav>
            <main style={{ width: `${width}px`, height: `${height}px` }}>
                <PinchZoomPan doubleTapBehavior='zoom' position='center' initialScale={1} minScale={1} maxScale={4} zoomButtons={false} debug={isDevelopment()}>
                    <img alt='Demo Image' src={`http://picsum.photos/${imageWidth}/${imageHeight}?random`} />
                </PinchZoomPan>
            </main>
        </div>
    );
}

const flexContentStyle = {
    fontSize: 20,
    margin: 'auto',
}
const FlexContainerView = ({menu}) => (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
        <nav style={{flex: 'none'}}>{menu}</nav>
        <div style={{flex: 'none', textAlign: 'center'}}><span style={flexContentStyle}>The image fills 100% of the flex item in which it is contained</span></div>
        <main style={{flex: 'auto', overflow: 'hidden', display: 'flex'}}>
            <div style={{flex: 'none', alignSelf: 'center'}}>
                <span style={flexContentStyle}>Sidebar</span>
            </div>
            <div style={{flex: 'auto', overflow: 'hidden', position: 'relative'}}>
                <div style={{position: 'absolute', height: '100%', width: '100%'}}>
                    <PinchZoomPan debug={isDevelopment()} position='center' zoomButtons={false}>
                        <img alt='Demo Image' src='http://picsum.photos/2560/1440?random' />
                    </PinchZoomPan>
                </div>
            </div>
        </main>
    </div>
)

const CustomZoomButtons = ({ scale, minScale, maxScale, onZoomInClick, onZoomOutClick }) => {
    const buttonStyles = {
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        backgroundColor: "white",
        border: "1px solid #ccc",
        display: "flex",
        flexFlow: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
        marginTop: "20px"
    };
    return (
        <div style={{ position: "absolute", bottom: "20px", right: "20px", zIndex: 1 }}>
            <button type="button" style={buttonStyles} onClick={onZoomOutClick} disabled={scale <= minScale} title="Zoom Out">
                <svg width="19" height="19" fill="none">
                    <line x1="0" y1="9.5" x2="19" y2="9.5" stroke="#000" />
                </svg>
            </button>
            <button type="button" style={buttonStyles} onClick={onZoomInClick} disabled={scale >= maxScale} title="Zoom In">
                <svg width="19" height="19" fill="none">
                    <line x1="0" y1="9.5" x2="19" y2="9.5" stroke="#000" />
                    <line x1="9.5" y1="0" x2="9.5" y2="19" stroke="#000" />
                </svg>
            </button>
        </div>

    )
};

const CustomZoomButtonsView = ({ menu }) => {
    const width = 300;
    const height =  500;
    const imageWidth = width * 2;
    const imageHeight = height * 2;
    return (
        <div>
            <nav>{menu}</nav>
            <main style={{ width: `${width}px`, height: `${height}px`, position: "relative"}}>
                <PinchZoomPan debug={isDevelopment()} zoomButtons={false} customZoomButtons={CustomZoomButtons}>
                    <img alt='Demo Image' src={`http://picsum.photos/${imageWidth}/${imageHeight}?random`} />
                </PinchZoomPan>
            </main>
        </div>
    );
}


const Menu = ({viewId, onViewChange}) => {
    const getLinkStyle = linkViewId => {
        return {
            padding: 10,
            color: viewId === linkViewId
                ? 'orange'
                : 'blue',
        };
    };

    return (
        <React.Fragment>
            <span style={{fontSize: 20, fontWeight: 'bold', padding: 10}}>Demo</span>
            <a href='#' onClick={() => onViewChange(0)} style={getLinkStyle(0)}>Small</a>
            <a href='#' onClick={() => onViewChange(1)} style={getLinkStyle(1)}>Medium</a>
            <a href='#' onClick={() => onViewChange(4)} style={getLinkStyle(4)}>Custom zoom buttons</a>
            <a href='#' onClick={() => onViewChange(3)} style={getLinkStyle(3)}>Centered</a>
            <a href='#' onClick={() => onViewChange(2)} style={getLinkStyle(2)}>Full-screen Flex</a>
        </React.Fragment>
    );
}

class App extends React.Component {
    state = {
        viewId: 0
    }
    
    handleViewChange = viewId => {
        this.setState({
            viewId
        });
    }

    render() {
        const { viewId } = this.state;
        const menu = <Menu viewId={viewId} onViewChange={this.handleViewChange} />
        return (
            viewId === 4 ? <CustomZoomButtonsView menu={menu} />
            : viewId === 2 ? <FlexContainerView menu={menu} />
            : viewId === 3 ? <CenteredView menu={menu} width={300} height={500} imageWidth={200} imageHeight={400} />
            : viewId === 1 ? <SizedContainerView menu={menu} width={500} height={800} />
            : <SizedContainerView menu={menu} width={300} height={500} />
        );
    }
}

render(<App />, document.getElementById("root"));