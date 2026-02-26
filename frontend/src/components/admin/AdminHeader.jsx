import React from 'react';
import { t } from '../../utils/i18n';
import LatencyIndicator from '../LatencyIndicator';

/**
 * AdminHeader Component
 * Displays the title, current show status, admin ping, and logout button
 */
const AdminHeader = ({ state, ui, onLogout, ping }) => (
    <header className="admin-header-container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        marginBottom: '20px'
    }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h1 style={{ margin: 0, lineHeight: 1.2 }}>{t(ui, 'ADMIN_DASHBOARD_TITLE')}</h1>
                {/* Admin's own latency indicator */}
                <LatencyIndicator ping={ping} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: state?.activeShowId ? '#22c55e' : '#ef4444',
                    flexShrink: 0
                }}></span>
                <small style={{
                    opacity: 0.8,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    lineHeight: 1
                }}>
                    {state?.activeShowId ? `Pack: ${state.activeShowId}` : t(ui, 'ADMIN_NO_SHOW_LOADED')}
                </small>
            </div>
        </div>

        <button
            onClick={onLogout}
            className="btn-danger"
            style={{ margin: 0 }}
        >
            {t(ui, 'ADMIN_BTN_LOGOUT')}
        </button>
    </header>
);

export default AdminHeader;