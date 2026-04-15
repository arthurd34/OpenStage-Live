import React from 'react';
import { t } from '../../utils/i18n';

const ShowLibrary = ({
                         state,
                         availableShows,
                         isUploading,
                         isLive,
                         onLoad,
                         onDelete,
                         onUpload,
                         fileInputRef,
                         emitAdmin, // Required for the toggle
                         ui
                     }) => {
    return (
        <section className="card">
            <h3>{t(ui, 'ADMIN_SHOW_CONFIG_TITLE')}</h3>

            {/* Shows List */}
            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', opacity: 0.7 }}>
                    {t(ui, 'ADMIN_SELECT_SHOW')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {availableShows.map(showId => {
                        const isActive = state?.activeShowId === showId;
                        return (
                            <div key={showId} className="user-row" style={{
                                border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                                background: isActive ? 'rgba(0, 212, 255, 0.05)' : 'rgba(255,255,255,0.02)'
                            }}>
                                <span style={{ color: isActive ? 'var(--primary)' : 'inherit', fontWeight: isActive ? 'bold' : 'normal' }}>
                                    {showId} {isActive && "✓"}
                                </span>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    {!isActive && (
                                        <button onClick={() => {
                                            const msg = isLive
                                                ? `⚠️ Le spectacle est en cours !\nCharger "${showId}" expulsera tous les joueurs connectés.\n\nContinuer ?`
                                                : `Charger le spectacle "${showId}" ?\nCela remplacera le spectacle actuel.`;
                                            if (window.confirm(msg)) onLoad(showId);
                                        }}>
                                            {t(ui, 'ADMIN_BTN_LOAD')}
                                        </button>
                                    )}
                                    <button className="btn-danger" onClick={() => onDelete(showId)}>🗑</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ZIP Upload Section */}
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '15px', marginBottom: '20px' }}>
                <input
                    type="file"
                    accept=".zip"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={onUpload}
                />
                <button
                    className="btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => fileInputRef.current.click()}
                    disabled={isUploading}
                >
                    {isUploading ? t(ui, 'ADMIN_UPLOADING') : t(ui, 'ADMIN_BTN_UPLOAD_ZIP')}
                </button>
            </div>

            {/* LIVE MODE TOGGLE */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '15px',
                background: isLive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: `1px solid ${isLive ? 'var(--success)' : 'transparent'}`
            }}>
                <div>
                    <h4 style={{ margin: 0 }}>{t(ui, 'ADMIN_LIVE_MODE')}</h4>
                    <small style={{ opacity: 0.7 }}>{isLive ? t(ui, 'ADMIN_LIVE_ON') : t(ui, 'ADMIN_LIVE_OFF')}</small>
                </div>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={!!isLive}
                        onChange={(e) => emitAdmin('admin_toggle_live', { value: e.target.checked })}
                    />
                    <span className="slider round"></span>
                </label>
            </div>
        </section>
    );
};

export default ShowLibrary;