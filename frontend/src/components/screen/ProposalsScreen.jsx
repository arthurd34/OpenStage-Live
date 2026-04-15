import React, { useState, useEffect } from 'react';

const PAGE_SIZE = 3;
const PAGE_DURATION_MS = 5000;
const FADE_DURATION_MS = 600;

const ProposalsScreen = ({ proposals }) => {
    const [page, setPage] = useState(0);
    const [visible, setVisible] = useState(true);

    const needsCycle = proposals.length > PAGE_SIZE;
    const totalPages = Math.ceil(proposals.length / PAGE_SIZE);

    // Reset to first page whenever the proposals list changes
    useEffect(() => {
        setPage(0);
        setVisible(true);
    }, [proposals]);

    useEffect(() => {
        if (!needsCycle) return;

        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setPage(p => (p + 1) % totalPages);
                setVisible(true);
            }, FADE_DURATION_MS);
        }, PAGE_DURATION_MS);

        return () => clearInterval(interval);
    }, [needsCycle, totalPages]);

    const current = needsCycle
        ? proposals.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        : proposals;

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_DURATION_MS}ms ease`
        }}>
            {needsCycle && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '40px',
                    display: 'flex',
                    gap: '8px'
                }}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <div key={i} style={{
                            width: '10px', height: '10px',
                            borderRadius: '50%',
                            background: i === page ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                            transition: 'background 0.3s'
                        }} />
                    ))}
                </div>
            )}

            {current.map((prop) => (
                <div key={prop.id} style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px',
                    background: prop.isWinner ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    borderBottom: current.length > 1 ? '2px solid rgba(255,255,255,0.1)' : 'none',
                    animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    <div style={{
                        borderLeft: prop.isWinner ? '20px solid #f59e0b' : '20px solid #00d4ff',
                        padding: '20px 60px',
                        textAlign: 'center'
                    }}>
                        <h1 style={{
                            fontSize: current.length > 2 ? '5rem' : '8rem',
                            margin: 0,
                            textTransform: 'uppercase',
                            lineHeight: 1.1
                        }}>
                            "{prop.text}"
                        </h1>
                        <h2 style={{ fontSize: '3rem', color: prop.isWinner ? '#f59e0b' : '#00d4ff', marginTop: '20px' }}>
                            {prop.isWinner && '🏆 '}{prop.userName}
                        </h2>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProposalsScreen;
