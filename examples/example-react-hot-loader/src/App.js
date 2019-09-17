import Counter from './Counter';
import { Internal } from './Internal';
import Switch from './Switch';
import './App.css';
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor() {
        super()
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) return null
        return this.props.children
    }
}

let App = () => (
    <ErrorBoundary>
        <div className="App">
            <h1>Hello World</h1>
            <Internal />
            <Counter />
            <ErrorBoundary>
                <Switch />
            </ErrorBoundary>
        </div>
    </ErrorBoundary>
);

export default App;
