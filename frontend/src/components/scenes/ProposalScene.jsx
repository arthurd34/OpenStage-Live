import React, { useState } from 'react';
import { t } from '../../utils/i18n';

const ProposalScene = ({ socket, name, gameState, history }) => {
    const { ui } = gameState;
    const [proposal, setProposal] = useState('');

    const params = gameState?.currentScene?.params ?? {};
    const maxProps = params.maxProposals ?? 3;
    const presetLabel = params.presetDisplayLabel || t(ui, 'PROPOSAL_DISPLAY_TITLE');
    const theme = params.titleDisplay || params.theme || null;
    const isLimitReached = history.length >= maxProps;

    const handleSend = () => {
        if (!proposal.trim() || isLimitReached) return;
        socket.emit('send_proposal', { userName: name, text: proposal });
        setProposal('');
    };

    const activePreset = gameState?.activePreset || null;

    return (
        <div className="scene-container">
            {theme && (
                <h3 style={{ textAlign: 'center', marginBottom: '16px', opacity: 0.9, lineHeight: 1.3 }}>
                    {theme}
                </h3>
            )}

            {activePreset && (
                <div style={{
                    marginBottom: '16px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '2px solid #f59e0b',
                    textAlign: 'center',
                    animation: 'fadeIn 0.4s ease'
                }}>
                    <small style={{ display: 'block', opacity: 0.6, marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px' }}>
                        {presetLabel}
                    </small>
                    <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>
                        {activePreset}
                    </strong>
                </div>
            )}

            <div className="input-group">
                <input
                    value={proposal}
                    onChange={e => setProposal(e.target.value)}
                    placeholder={isLimitReached
                        ? t(ui, 'PROPOSAL_LIMIT_MSG', { max: maxProps })
                        : t(ui, 'PROPOSAL_INPUT_PLACEHOLDER')
                    }
                    disabled={isLimitReached}
                />
                <button
                    className="btn-primary"
                    onClick={handleSend}
                    disabled={!proposal.trim() || isLimitReached}
                >
                    {t(ui, 'PROPOSAL_SEND')}
                </button>
            </div>

            {history.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4>
                        {maxProps === 1
                            ? t(ui, 'PROPOSAL_TITLE_SINGLE')
                            : t(ui, 'PROPOSAL_TITLE_PLURAL', { count: history.length, max: maxProps })
                        }
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {history.map(h => (
                            <div key={h.id} className="history-item" style={{
                                padding: '8px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                                borderLeft: h.isWinner ? '3px solid gold' : 'none',
                                fontSize: '0.9rem'
                            }}>
                                <span>{h.text}</span>
                                {h.isWinner && <span> {t(ui, 'PROPOSAL_WINNER_ICON')}</span>}
                                <small style={{ float: 'right', opacity: 0.5 }}>{h.timestamp}</small>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProposalScene;