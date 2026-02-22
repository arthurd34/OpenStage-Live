import React from 'react';

const Leaderboard = ({ scores, ui }) => {
    // Sort scores from highest to lowest
    const sortedScores = Object.entries(scores || {})
        .sort(([, a], [, b]) => b - a);

    if (sortedScores.length === 0) return null;

    const getPodiumStyle = (index) => {
        switch (index) {
            case 0: return { border: '2px solid #ffd700', background: 'rgba(255, 215, 0, 0.15)', icon: '🥇' }; // Gold
            case 1: return { border: '2px solid #c0c0c0', background: 'rgba(192, 192, 192, 0.15)', icon: '🥈' }; // Silver
            case 2: return { border: '2px solid #cd7f32', background: 'rgba(205, 127, 50, 0.15)', icon: '🥉' };  // Bronze
            default: return { border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', icon: '' };
        }
    };

    return (
        <div className="leaderboard-container" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedScores.map(([name, score], index) => {
                    const style = getPodiumStyle(index);
                    return (
                        <div key={name} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 15px',
                            borderRadius: '10px',
                            border: style.border,
                            background: style.background,
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ width: '25px', fontWeight: 'bold' }}>
                                    {style.icon ? style.icon : `${index + 1}.`}
                                </span>
                                <span style={{ fontWeight: index < 3 ? 'bold' : 'normal' }}>{name}</span>
                            </div>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{score} <small>pts</small></span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Leaderboard;