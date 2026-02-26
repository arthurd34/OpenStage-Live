import React, { useState } from 'react';

/**
 * LatencyIndicator Component
 * Displays network strength bars based on ping ms
 */
const LatencyIndicator = ({ ping }) => {
    const [showMs, setShowMs] = useState(false);

    // Logic to determine signal strength (0 to 4 bars)
    const getBars = (ms) => {
        if (ms < 0) return 0;
        if (ms < 50) return 4;   // Excellent
        if (ms < 150) return 3;  // Good
        if (ms < 300) return 2;  // Fair
        return 1;                // Poor / Unstable
    };

    const bars = getBars(ping);
    const isUnstable = bars <= 1 && ping > 0;

    const barStyle = (index) => ({
        width: '4px',
        marginRight: '2px',
        borderRadius: '1px',
        backgroundColor: index <= bars
            ? (bars <= 1 ? '#ef4444' : (bars <= 2 ? '#f59e0b' : '#22c55e'))
            : 'rgba(255,255,255,0.2)',
        height: `${(index + 1) * 3}px`
    });

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div
                style={{ display: 'flex', alignItems: 'flex-end', cursor: 'help', padding: '5px' }}
                onMouseEnter={() => setShowMs(true)}
                onMouseLeave={() => setShowMs(false)}
            >
                {[0, 1, 2, 3].map(i => <div key={i} style={barStyle(i)} />)}

                {showMs && (
                    <span style={{
                        marginLeft: '8px', fontSize: '0.7rem', background: 'black',
                        padding: '2px 5px', borderRadius: '4px', position: 'absolute', left: '25px'
                    }}>
                        {ping}ms
                    </span>
                )}
            </div>

            {isUnstable && (
                <div style={{
                    fontSize: '0.6rem', color: '#ef4444', fontWeight: 'bold',
                    animation: 'fadeIn 0.5s infinite alternate'
                }}>
                    ⚠️ CONNEXION INSTABLE
                </div>
            )}
        </div>
    );
};

export default LatencyIndicator;