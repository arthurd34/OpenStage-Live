import React from 'react';
import { t } from '../../utils/i18n';

const AccessControl = ({ state, allowJoins, accessConfig, onToggleJoins, onUpdateConfig, onAddCode, onRemoveCode, newCodeInputRef, ui }) => {

    const MAX_CODES = 50;
    const clientUrl = window.location.origin;

    // --- LOGIC: GENERATE BULK ---
    const handleGenerateBulk = () => {
        const currentCount = accessConfig.whitelist.length;
        if (currentCount >= MAX_CODES) return alert(`Limit reached (${MAX_CODES} max)`);
        const remaining = MAX_CODES - currentCount;
        const input = prompt(`How many codes to generate? (Max: ${remaining})`, remaining.toString());
        const count = parseInt(input);
        if (isNaN(count) || count <= 0) return;
        const finalCount = Math.min(count, remaining);

        const newCodes = [];
        const existingCodes = accessConfig.whitelist.map(c => c.code);
        for (let i = 0; i < finalCount; i++) {
            let code;
            do {
                code = Math.random().toString(36).substring(2, 6).toUpperCase();
            } while (existingCodes.includes(code) || newCodes.some(c => c.code === code));
            newCodes.push({ code, used: false, playerName: '' });
        }
        onUpdateConfig({ whitelist: [...accessConfig.whitelist, ...newCodes] });
    };

    // --- LOGIC: REGENERATE PUBLIC ---
    const handleRegeneratePublicCode = () => {
        if (window.confirm("Regenerate a new public access code?")) {
            const newCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            onUpdateConfig({ publicCode: newCode });
        }
    };

    // --- LOGIC: PRINT QRCODE ---
    const handlePrintCodes = () => {
        const printWindow = window.open('', '_blank');
        const codesToPrint = accessConfig.mode === 'PUBLIC'
            ? [{ code: accessConfig.publicCode }]
            : accessConfig.whitelist;

        // Fetch translations for the print layout
        const txtScan = t(ui, 'ADMIN_PRINT_SCAN_TO_JOIN') || "Scan to join";
        const txtManual = t(ui, 'ADMIN_PRINT_MANUAL_MODE') || "Manual mode:";
        const txtStep1 = t(ui, 'ADMIN_PRINT_STEP_1') || "Go to";
        const txtStep2 = t(ui, 'ADMIN_PRINT_STEP_2') || "Enter your name and the code.";
        const txtPrintBtn = t(ui, 'BTN_PRINT') || "PRINT QRCODE";
        const txtPrintAdvice = t(ui, 'ADMIN_PRINT_ADVICE') || "Tip: Disable margins in print options.";

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Qrcode - Open Stage Live</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                    
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #f0f0f0; color: #333; }
                    
                    .page { 
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
                        gap: 15px; 
                        padding: 20px; 
                    }

                    .ticket { 
                        background: white; 
                        border: 2px solid #333; 
                        border-radius: 12px; 
                        padding: 20px; 
                        text-align: center;
                        position: relative;
                        page-break-inside: avoid;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        min-height: 320px;
                    }

                    /* Title is now neutral (black/dark grey) */
                    .header { font-weight: bold; font-size: 1.1rem; color: #333; text-transform: uppercase; margin-bottom: 10px; }
                    
                    .qr-box { margin: 15px 0; }
                    .qr-box img { width: 140px; height: 140px; }
                    
                    .code-label { font-size: 0.7rem; color: #666; text-transform: uppercase; margin-top: 5px; }
                    .code-value { font-size: 1.8rem; font-weight: bold; letter-spacing: 3px; color: #333; margin-bottom: 10px; }
                    
                    .manual-instructions { 
                        border-top: 1px solid #eee; 
                        padding-top: 10px; 
                        font-size: 0.75rem; 
                        color: #444; 
                        line-height: 1.4;
                    }

                    .url { font-weight: bold; color: #333; word-break: break-all; margin-bottom: 4px; display: block; }

                    @media print {
                        body { background: white; }
                        .no-print { display: none; }
                        .page { padding: 0; gap: 10px; }
                        .ticket { border: 1px solid #ccc; box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="background: #333; color: white; padding: 15px; text-align: center;">
                    <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; font-weight: bold; text-transform: uppercase;">
                        🖨️ ${txtPrintBtn}
                    </button>
                    <p style="font-size: 0.8rem; margin-top: 8px; opacity: 0.8;">${txtPrintAdvice}</p>
                </div>

                <div class="page">
                    ${codesToPrint.map(item => `
                        <div class="ticket">
                            <div class="header">Open Stage Live</div>
                            
                            <div class="qr-box">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(clientUrl + '?code=' + item.code)}" />
                                <div class="code-label">${txtScan}</div>
                            </div>

                            <div>
                                <div class="code-value">${item.code}</div>
                                
                                <div class="manual-instructions">
                                    <strong>${txtManual}</strong><br/>
                                    1. ${txtStep1} <span class="url">${clientUrl.replace(/^https?:\/\//, '')}</span>
                                    2. ${txtStep2}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // --- DYNAMIC STYLES ---
    const cardStatusStyle = {
        transition: 'all 0.3s ease',
        borderTop: `4px solid ${allowJoins ? '#22c55e' : '#ef4444'}`,
        backgroundColor: allowJoins ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
    };

    return (
        <section className="card" style={cardStatusStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>{t(ui, 'ADMIN_ACCESS_CONTROL')}</h3>
                <button onClick={handlePrintCodes} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
                    🖨️ {t(ui, 'PRINT_QRCODE') || 'Print'}
                </button>
            </div>

            {/* Registration Toggle */}
            <div className="admin-toggle-row" style={{
                marginBottom: '20px',
                padding: '10px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px'
            }}>
                <label className="switch">
                    <input type="checkbox" checked={allowJoins} onChange={onToggleJoins} />
                    <span className="slider round"></span>
                </label>
                <h4 style={{ margin: 0, color: allowJoins ? '#22c55e' : '#ef4444' }}>
                    {allowJoins ? t(ui, 'ADMIN_JOINS_OPEN') : t(ui, 'ADMIN_JOINS_CLOSED')}
                </h4>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    className={accessConfig.mode === 'PUBLIC' ? 'btn-primary' : ''}
                    style={{ flex: 1 }}
                    onClick={() => onUpdateConfig({ mode: 'PUBLIC' })}
                >
                    {t(ui, 'ADMIN_MODE_PUBLIC')}
                </button>
                <button
                    className={accessConfig.mode === 'WHITELIST' ? 'btn-primary' : ''}
                    style={{ flex: 1 }}
                    onClick={() => onUpdateConfig({ mode: 'WHITELIST' })}
                >
                    {t(ui, 'ADMIN_MODE_WHITELIST')}
                </button>
            </div>

            {accessConfig.mode === 'PUBLIC' ? (
                /* --- PUBLIC MODE UI --- */
                <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>
                        {t(ui, 'ADMIN_PUBLIC_KEY_LABEL')}
                    </label>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', letterSpacing: '6px', color: 'var(--primary)', marginBottom: '15px' }}>
                        {accessConfig.publicCode || '----'}
                    </div>
                    <button onClick={handleRegeneratePublicCode} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                        🔄 {t(ui, 'BTN_REFRESH')}
                    </button>
                </div>
            ) : (
                /* --- WHITELIST MODE UI --- */
                <div className="whitelist-manager">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <small style={{ color: accessConfig.whitelist.length >= MAX_CODES ? '#ef4444' : 'inherit', opacity: 0.8 }}>
                            {accessConfig.whitelist.length} / {MAX_CODES} codes
                        </small>

                        <div style={{ display: 'flex', gap: '5px' }}>
                            {accessConfig.whitelist.length > 0 && (
                                <button
                                    className="btn-danger"
                                    style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                                    onClick={() => window.confirm(t(ui, 'CONFIRM_CLEAR_PROPOSALS')) && onUpdateConfig({ whitelist: [] })}
                                >
                                    {t(ui, 'CLEAR_LIST')}
                                </button>
                            )}
                            {accessConfig.whitelist.length < MAX_CODES && (
                                <button
                                    onClick={handleGenerateBulk}
                                    style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                                >
                                    + {t(ui, 'ADMIN_GENERATE_BULK')}
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                        <input
                            ref={newCodeInputRef}
                            className="admin-input"
                            disabled={accessConfig.whitelist.length >= MAX_CODES}
                            placeholder={accessConfig.whitelist.length >= MAX_CODES ? t(ui, 'ADMIN_WHITELIST_FULL') : t(ui, 'ADMIN_WHITELIST_ADD_PH')}
                            style={{ flex: 1 }}
                            onKeyDown={(e) => e.key === 'Enter' && onAddCode()}
                        />
                        <button onClick={onAddCode} disabled={accessConfig.whitelist.length >= MAX_CODES}>+</button>
                    </div>

                    {/* Scrollable area */}
                    <div style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '6px',
                        padding: '5px'
                    }}>
                        {accessConfig.whitelist.length === 0 ? (
                            <p style={{ textAlign: 'center', opacity: 0.4, padding: '10px', fontSize: '0.8rem' }}>
                                {t(ui, 'ADMIN_WHITELIST_NO_CODES')}
                            </p>
                        ) : (
                            accessConfig.whitelist.map(c => (
                                <div key={c.code} className="user-row small" style={{ marginBottom: '4px', padding: '4px 8px' }}>
                                    <span style={{ fontFamily: 'monospace', color: c.used ? '#22c55e' : 'inherit', fontSize: '0.9rem' }}>
                                        {c.code} {c.used && <small style={{ opacity: 0.5 }}>({c.playerName})</small>}
                                    </span>
                                    <button className="btn-danger" style={{ padding: '0px 6px' }} onClick={() => onRemoveCode(c.code)}>×</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default AccessControl;