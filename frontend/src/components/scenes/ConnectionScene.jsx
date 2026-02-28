import React from 'react';
import { t } from '../../utils/i18n';

const ConnectionScene = ({
                             name,
                             setName,
                             entryCode,
                             setEntryCode,
                             handleJoin,
                             status,
                             message,
                             ui,
                             isLive,
                             showName
                         }) => {

    // --- CASE 1: Show is NOT LIVE yet (Welcome message only) ---
    if (isLive === false) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <h2>{t(ui, 'CONN_WELCOME_TITLE')}</h2>
                <div style={{ fontSize: '4rem', margin: '20px 0' }}>🎤</div>
                <p style={{ lineHeight: '1.6', opacity: 0.9 }}>
                    {t(ui, 'CONN_NOT_STARTED_MSG')}
                </p>
                <div className="spinner" style={{ marginTop: '30px' }}></div>
            </div>
        );
    }

    // --- CASE 2: Waiting for Admin approval ---
    if (status === 'pending') {
        return (
            <div className="card" style={{ textAlign: 'center' }}>
                <div className="spinner"></div>
                <h3>{t(ui, 'CONN_PENDING_TITLE')}</h3>
                <p>{t(ui, 'CONN_PENDING_MSG')}</p>
                <small style={{ opacity: 0.7 }}>{t(ui, 'CONN_DONT_REFRESH')}</small>
            </div>
        );
    }

    // --- CASE 3: Normal Login Form (Show is Live) ---
    return (
        <div className="card">
            <h2>{t(ui, 'CONN_JOIN_TITLE', { showName: showName || '...' })}</h2>
            <form onSubmit={handleJoin}>
                {/* Player Name Input */}
                <input
                    type="text"
                    placeholder={t(ui, 'CONN_INPUT_PLACEHOLDER')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                    required
                />

                {/* Session Access Code Input */}
                <div style={{ marginTop: '15px' }}>
                    <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '5px' }}>
                        {t(ui, 'ADMIN_PUBLIC_KEY_LABEL') || 'Code'}
                    </label>
                    <input
                        type="text"
                        placeholder="XXXX"
                        maxLength="4"
                        value={entryCode}
                        onChange={e => setEntryCode(e.target.value.toUpperCase())}
                        style={{
                            textAlign: 'center',
                            letterSpacing: '5px',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            textTransform: 'uppercase'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: '100%', marginTop: '20px' }}
                    disabled={!name.trim() || !entryCode.trim()}
                >
                    {t(ui, 'CONN_BTN_JOIN')}
                </button>
            </form>

            {message && (
                <div className="error-box" style={{ marginTop: '15px' }}>
                    {t(ui, message)}
                </div>
            )}
        </div>
    );
};

export default ConnectionScene;