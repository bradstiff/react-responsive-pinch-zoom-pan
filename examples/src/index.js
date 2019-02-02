import React from "react";
import { render } from "react-dom";
import PinchZoomPan from "../../src/PinchZoomPan";

const StaticContainerView = ({menu}) => (
    <div>
        <nav>{menu}</nav>
        <main style={{ width: '500px', height: '500px' }}>
            <PinchZoomPan>
                <img alt='Demo Image' src='http://picsum.photos/1000/1000?random' />
            </PinchZoomPan>
        </main>
    </div>
)

const flexContentStyle = {
    fontSize: 20,
    margin: 'auto',
}
const FlexContainerView = ({menu}) => (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
        <nav style={{flex: 'none'}}>{menu}</nav>
        <div style={{flex: 'none', textAlign: 'center'}}><span style={flexContentStyle}>The image container dimensions are dynamic based on CSS Flex</span></div>
        <main style={{flex: 'auto', overflow: 'hidden', display: 'flex'}}>
            <div style={{flex: 'none', alignSelf: 'center'}}>
                <span style={flexContentStyle}>Sidebar</span>
            </div>
            <div style={{flex: 'auto', overflow: 'hidden'}}>
                <PinchZoomPan>
                    <img alt='Demo Image' src='http://picsum.photos/2560/1440?random' />
                </PinchZoomPan>
            </div>
        </main>
    </div>
)

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
            <a href='#' onClick={() => onViewChange(0)} style={getLinkStyle(0)}>Explicit Sizing</a>
            <a href='#' onClick={() => onViewChange(1)} style={getLinkStyle(1)}>Flex Sizing</a>
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
        return viewId === 1 
            ? <FlexContainerView menu={menu} />
            : <StaticContainerView menu={menu} />;
    }
}

render(<App />, document.getElementById("root"));