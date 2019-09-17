import React from 'react';   
import './Switch.css';

export default function Switch() {
    const [value, setValue] = React.useState(true)

    return (
        <div
            className="Switch"
            data-active={value}
            onClick={() => setValue(v => !v)}
            style={{
                //fontSize: 30
            }}
        >
            {value ? 'On' : 'Off'}
        </div>
    );
}
