import React, { useState } from 'react';
import { t } from '../../utils/i18n';

const ProposalAdmin = ({ ui, proposals, socket, token, currentScene }) => {
    const [customText, setCustomText] = useState('');
    const [activePreset, setActivePreset] = useState(null);
    const presets = currentScene?.params?.presets || [];

    const handleClearAll = () => {
        if (window.confirm(t(ui, 'CONFIRM_CLEAR_PROPOSALS'))) {
            socket.emit('admin_clear_all_proposals', { token });
        }
    };

    const handleDelete = (id) => {
        socket.emit('admin_delete_proposal', { token, id });
    };

    const handleToggleDisplay = (proposal) => {
        socket.emit('admin_display_proposal', {
            token,
            id: proposal.id,
            value: !proposal.isDisplayed
        });
    };

    const handleToggleWinner = (proposal) => {
        socket.emit('admin_set_winner', {
            token,
            id: proposal.id,
            value: !proposal.isWinner
        });
    };

    const handleSendPreset = (text) => {
        if (activePreset === text) {
            socket.emit('admin_set_proposal_winner', { token, text, action: 'HIDE' });
            setActivePreset(null);
            return;
        }

        if (window.confirm(`Voulez-vous diffuser "${text}" à l'écran ?`)) {
            socket.emit('admin_set_proposal_winner', { token, text, action: 'SHOW' });
            setActivePreset(text);
        }
    };

    const handleSendCustom = (e) => {
        e.preventDefault();
        if (!customText.trim()) return;

        // On envoie le token pour que le serveur sache que c'est une commande admin
        socket.emit('send_proposal', {
            token,
            userName: "ADMIN",
            text: customText.trim(),
            isAdmin: true
        });
        setCustomText('');
    };

    return (
        <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0 }}>{t(ui, 'PUBLIC_RESPONSES')}</h3>
                <button className="btn-danger" onClick={handleClearAll} style={{ fontSize: '0.8rem' }}>
                    {t(ui, 'CLEAR_LIST')}
                </button>
            </div>

            {/* --- PRESETS SECTION --- */}
            {presets.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <small style={{ display: 'block', marginBottom: '10px', opacity: 0.5, fontWeight: 'bold' }}>PRESETS (CLIQUER POUR TOGGLE) :</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {presets.map((p, i) => (
                            <button
                                key={i}
                                className="btn-secondary"
                                style={{
                                    fontSize: '0.8rem',
                                    border: activePreset === p ? '2px solid #00d4ff' : '1px solid transparent',
                                    backgroundColor: activePreset === p ? 'rgba(0, 212, 255, 0.2)' : ''
                                }}
                                onClick={() => handleSendPreset(p)}
                            >
                                {activePreset === p ? `📺 ${p}` : p}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSendCustom} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Réponse manuelle..."
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '8px 15px' }}>
                    Ajouter
                </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {proposals.length === 0 && (
                    <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>
                        {t(ui, 'WAITING_FOR_PROPOSALS')}
                    </p>
                )}

                {proposals.map(ans => (
                    <div key={ans.id} className="user-row" style={{
                        borderLeft: ans.isWinner ? '5px solid #f59e0b' : '5px solid rgba(255,255,255,0.1)',
                        paddingLeft: '15px',
                        background: ans.isAdmin ? 'rgba(0, 212, 255, 0.08)' : (ans.isWinner ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255,255,255,0.02)'),
                        transition: 'all 0.3s ease',
                        outline: ans.isDisplayed ? '2px solid #00d4ff' : 'none',
                        outlineOffset: '-2px'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <strong style={{ color: ans.isAdmin ? '#00d4ff' : (ans.isWinner ? '#f59e0b' : '#00d4ff'), fontSize: '0.9rem' }}>
                                    {ans.userName} {ans.isWinner && '🏆'}
                                </strong>
                                <small style={{ opacity: 0.4, fontSize: '0.7rem' }}>{ans.timestamp}</small>
                            </div>
                            <div style={{ fontSize: '1.05rem', lineHeight: '1.4', fontWeight: ans.isDisplayed ? 'bold' : 'normal' }}>
                                {ans.text}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={() => handleToggleDisplay(ans)}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    backgroundColor: ans.isDisplayed ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                                    color: 'white', border: 'none', borderRadius: '4px'
                                }}
                            >
                                {ans.isDisplayed ? '📺 DIFFUSÉ' : '📺 DIFFUSER'}
                            </button>

                            <button
                                onClick={() => handleSetWinner(ans)}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    border: ans.isWinner ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.2)',
                                    background: ans.isWinner ? 'transparent' : 'rgba(255,255,255,0.05)',
                                    color: ans.isWinner ? '#f59e0b' : 'white',
                                    borderRadius: '4px'
                                }}
                            >
                                {ans.isWinner ? '❌ DÉMARQUER' : '🏆 GAGNANT'}
                            </button>

                            <button
                                className="btn-danger"
                                onClick={() => handleDelete(ans.id)}
                                style={{ padding: '6px 10px', minWidth: '35px' }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProposalAdmin;