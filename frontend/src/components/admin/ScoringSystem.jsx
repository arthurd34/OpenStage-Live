import React from 'react';
import { t } from '../../utils/i18n';

const ScoringSystem = ({ state, users, ui, onAddPoints, onReset, onToggleVisibility }) => {
    // Hidden if the show config doesn't enable points
    if (!state?.hasPoints) return null;

    const scores = state.scores || {};
    const isScoreVisible = state.isScoreVisible || false;

    return (
        <section className="card" style={{ borderTop: '4px solid #f59e0b' }}>
            {/* Header with visibility toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>🏆 {t(ui, 'ADMIN_SCORES_TITLE')}</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem' }}>
                        {t(ui, 'ADMIN_SCORES_VISIBILITY')}
                    </span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={isScoreVisible}
                            onChange={(e) => onToggleVisibility(e.target.checked)}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
            </div>

            {/* Players list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {users.length === 0 && (
                    <p style={{ textAlign: 'center', opacity: 0.5 }}>
                        {t(ui, 'NO_PLAYERS_CONNECTED')}
                    </p>
                )}

                {users.map(u => (
                    <div key={u.socketId} className="user-row" style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold' }}>{u.name}</span>
                            <span style={{ fontSize: '1.2rem', color: '#f59e0b' }}>
                                {scores[u.name] || 0} <small>{t(ui, 'POINTS_SHORT')}</small>
                            </span>
                        </div>

                        {/* Scoring buttons: +1, +2, +3, +5 and one -1 for corrections */}
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            {[1, 2, 3, 5].map(val => (
                                <button
                                    key={`plus-${val}`}
                                    className="btn-small"
                                    onClick={() => onAddPoints(u.name, val)}
                                >
                                    +{val}
                                </button>
                            ))}
                            <button
                                className="btn-danger btn-small"
                                style={{ marginLeft: '10px' }}
                                onClick={() => onAddPoints(u.name, -1)}
                                title={t(ui, 'SCORE_CORRECTION_DESC')}
                            >
                                -1
                            </button>
                        </div>
                    </div>
                ))}

                {/* Reset Action */}
                <button
                    className="btn-danger"
                    style={{ marginTop: '10px', width: '100%' }}
                    onClick={() => window.confirm(t(ui, 'CONFIRM_RESET_SCORES')) && onReset()}
                >
                    {t(ui, 'ADMIN_RESET_BTN')}
                </button>
            </div>
        </section>
    );
};

export default ScoringSystem;