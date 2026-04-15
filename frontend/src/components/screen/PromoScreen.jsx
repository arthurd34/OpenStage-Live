import React, { useRef, useLayoutEffect, useState } from 'react';

const PromoScreen = ({ scene }) => {
    const params = scene?.params || {};
    const title = params.title || '';
    const lines = params.lines || [];

    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const [shouldScroll, setShouldScroll] = useState(false);

    useLayoutEffect(() => {
        setShouldScroll(false);
        requestAnimationFrame(() => {
            if (wrapperRef.current && listRef.current) {
                setShouldScroll(listRef.current.scrollHeight > wrapperRef.current.clientHeight);
            }
        });
    }, [lines]);

    // 4s per line, minimum 20s
    const duration = Math.max(20, lines.length * 4);

    const renderLine = (line, key) => {
        const text = typeof line === 'string' ? line : line.text;
        return (
            <div key={key} style={{
                fontSize: '3rem',
                padding: '24px 48px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                textAlign: 'left',
                flexShrink: 0
            }}>
                {text}
            </div>
        );
    };

    return (
        <div style={{
            textAlign: 'center',
            margin: 'auto',
            width: '100%',
            padding: '0 80px',
            animation: 'fadeIn 1s ease',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '100vh',
            boxSizing: 'border-box'
        }}>
            {title && (
                <h1 style={{ fontSize: '6rem', margin: '0 0 40px', textTransform: 'uppercase', flexShrink: 0 }}>
                    {title}
                </h1>
            )}

            <div ref={wrapperRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div
                    ref={listRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        maxWidth: '1100px',
                        margin: '0 auto',
                        animation: shouldScroll ? `promoScroll ${duration}s linear infinite` : 'none'
                    }}
                >
                    {lines.map((line, i) => renderLine(line, i))}
                    {/* Duplicate for seamless loop */}
                    {shouldScroll && lines.map((line, i) => renderLine(line, `dup-${i}`))}
                </div>
            </div>

            <style>{`
                @keyframes promoScroll {
                    0%   { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
            `}</style>
        </div>
    );
};

export default PromoScreen;
