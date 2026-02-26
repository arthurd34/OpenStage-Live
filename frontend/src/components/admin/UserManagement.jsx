import React from 'react';
import { t } from '../../utils/i18n';
import LatencyIndicator from '../LatencyIndicator';

const UserManagement = ({ requests, users, onApprove, onKick, onRename, ui }) => {
    return (
        <div className="admin-grid">
            {/* --- PENDING REQUESTS --- */}
            <section className="card">
                <h3>{t(ui, 'ADMIN_TITLE_REQUESTS', { count: requests.length })}</h3>
                <div className="user-list-container">
                    {requests.length === 0 ? (
                        <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>{t(ui, 'NO_REQUESTS')}</p>
                    ) : (
                        requests.map(r => (
                            <div key={r.socketId} className="user-row">
                                <div className="user-info">
                                    <strong>{r.name}</strong>
                                    {r.entryCode && <small style={{ marginLeft: '8px', opacity: 0.6 }}>[{r.entryCode}]</small>}
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button
                                        className="btn-success"
                                        onClick={() => onApprove(r.socketId)}
                                    >
                                        {t(ui, 'APPROVE')}
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={() => onKick(r.socketId, true)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* --- ACTIVE PLAYERS --- */}
            <section className="card">
                <h3>{t(ui, 'ADMIN_TITLE_PLAYERS', { count: users.length })}</h3>
                <div className="user-list-container">
                    {users.length === 0 ? (
                        <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>{t(ui, 'NO_PLAYERS')}</p>
                    ) : (
                        users.map(u => (
                            <div key={u.socketId} className="user-row">
                                <div className="user-info">
                                    <div className="user-info" style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ color: u.connected ? '#22c55e' : '#ef4444', marginRight: '8px' }}>●</span>
                                        <div style={{ marginRight: '15px' }}>
                                            <LatencyIndicator ping={u.ping || 0} />
                                        </div>
                                        <span style={{ fontWeight: u.connected ? 'bold' : 'normal' }}>{u.name}</span>
                                    </div>
                                    <span style={{ fontWeight: u.connected ? 'bold' : 'normal', opacity: u.connected ? 1 : 0.6 }}>
                                        {u.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button
                                        onClick={() => onRename(u.socketId, u.name)}
                                        style={{ padding: '4px 8px' }}
                                    >
                                        {t(ui, 'EDIT')}
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={() => onKick(u.socketId, false)}
                                        style={{ padding: '4px 8px' }}
                                    >
                                        {t(ui, 'KICK')}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default UserManagement;