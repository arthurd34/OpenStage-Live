import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { t } from '../utils/i18n';

// Components
import ConnectionScene from '../components/scenes/ConnectionScene';
import ProposalScene from '../components/scenes/ProposalScene';
import WaitingScene from '../components/scenes/WaitingScene';
import Leaderboard from '../components/scenes/Leaderboard';
import Footer from '../components/Footer';
import ConnectionErrorOverlay from '../components/overlays/ConnectionErrorOverlay';

// Ensure the CSS provided below is in your stylesheet
import './PublicView.css';

const socketUrl = import.meta.env.VITE_BACKEND_URL;
const socket = io(socketUrl, { transports: ["websocket"] });

const PublicView = () => {
    // --- STATES ---
    const [name, setName] = useState('');
    const [entryCode, setEntryCode] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [gameState, setGameState] = useState(null);
    const [history, setHistory] = useState([]);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [countdown, setCountdown] = useState(15);

    // --- ANIMATION STATES ---
    const [scoreDiff, setScoreDiff] = useState(null);
    const [animateScore, setAnimateScore] = useState(false);
    const prevScoreRef = useRef(0);

    const timerRef = useRef(null);
    const nameRef = useRef('');
    const ui = gameState?.ui || {};

    // --- DERIVED STATE: SCORE & VISIBILITY ---
    const myScore = gameState?.scores?.[name] || 0;
    const showPoints = gameState?.hasPoints || false;
    const isScoreVisible = gameState?.isScoreVisible || false;

    // --- EFFECT: DETECT SCORE CHANGE & TRIGGER ANIMATION ---
    useEffect(() => {
        if (myScore !== prevScoreRef.current) {
            const diff = myScore - prevScoreRef.current;

            // Trigger animation for any change (positive or negative)
            setScoreDiff(diff);
            setAnimateScore(true);

            // Reset animation states after duration
            const timeout = setTimeout(() => {
                setAnimateScore(false);
                setScoreDiff(null);
            }, 500);

            prevScoreRef.current = myScore;
            return () => clearTimeout(timeout);
        }
    }, [myScore]);

    // --- EFFECT: URL CODE PARSING ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const codeFromUrl = params.get('code');
        if (codeFromUrl) {
            setEntryCode(codeFromUrl.toUpperCase());
        }
    }, []);

    // --- EFFECT: SOCKET CONNECTIVITY ---
    useEffect(() => {
        const onConnect = () => {
            setIsConnected(true);
            setCountdown(15);
            if (timerRef.current) clearInterval(timerRef.current);
            const token = localStorage.getItem('player_token');
            if (token) socket.emit('join_request', { token, isReconnect: true });
        };

        const onDisconnect = () => {
            setIsConnected(false);
            timerRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) { window.location.reload(); return 0; }
                    return prev - 1;
                });
            }, 1000);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    useEffect(() => { nameRef.current = name; }, [name]);

    // --- EFFECT: GAME EVENTS ---
    useEffect(() => {
        const savedToken = localStorage.getItem('player_token');
        const savedName = localStorage.getItem('player_name');

        if (savedToken) {
            if (savedName) setName(savedName);
            setStatus('pending');
            socket.emit('join_request', { token: savedToken, isReconnect: true });
        }

        socket.on('status_update', (data) => {
            setStatus(data.status);
            if (data.token) localStorage.setItem('player_token', data.token);

            if (data.status === 'approved') {
                const finalName = data.name || nameRef.current;
                localStorage.setItem('player_name', finalName);
                if (data.name) setName(data.name);
                setMessage('');
                // Initialize score ref on approval
                if (gameState?.scores?.[finalName]) {
                    prevScoreRef.current = gameState.scores[finalName];
                }
            } else {
                if (data.transData) {
                    setMessage({ key: data.reason, data: data.transData });
                } else {
                    setMessage(data.reason || '');
                }

                if (['rejected', 'kicked', 'session_expired'].includes(data.status)) {
                    localStorage.removeItem('player_name');
                    localStorage.removeItem('player_token');
                    socket.disconnect();
                    setTimeout(() => socket.connect(), 1000);
                }
            }
        });

        socket.on('sync_state', setGameState);
        socket.on('name_updated', (newName) => {
            setName(newName);
            localStorage.setItem('player_name', newName);
        });
        socket.on('user_history_update', setHistory);

        return () => {
            socket.off('status_update');
            socket.off('sync_state');
            socket.off('name_updated');
            socket.off('user_history_update');
        };
    }, []);

    // --- HANDLER: JOIN SHOW ---
    const handleJoin = (e) => {
        if (e) e.preventDefault();
        if (!name.trim()) return;
        setMessage('');
        setStatus('pending');
        socket.emit('join_request', {
            name: name.trim(),
            entryCode: entryCode.trim().toUpperCase(),
            isReconnect: false
        });
    };

    // --- RENDER: LOGIN / PENDING ---
    if (status !== 'approved') {
        return (
            <div className="app-container">
                <div className="main-content">
                    <ConnectionScene
                        name={name} setName={setName}
                        entryCode={entryCode} setEntryCode={setEntryCode}
                        handleJoin={handleJoin} status={status}
                        message={message} ui={ui}
                        isLive={gameState?.isLive}
                        showName={gameState?.showName}
                    />
                </div>
                <Footer version={gameState?.version} ui={ui} />
            </div>
        );
    }

    // --- RENDER: SHOW NOT STARTED ---
    if (gameState && gameState.isLive === false) {
        return (
            <div className="app-container">
                <div className="main-content">
                    <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
                        <h2>{t(ui, 'SHOW_NOT_STARTED')}</h2>
                        <p style={{ opacity: 0.7, maxWidth: '300px', margin: '0 auto' }}>
                            {t(ui, 'ERROR_SHOW_NOT_STARTED')}
                        </p>
                        <div className="spinner" style={{ marginTop: '40px' }}></div>
                    </div>
                </div>
                <Footer version={gameState?.version} ui={ui} />
            </div>
        );
    }

    // --- RENDER: ACTIVE SHOW ---
    const sceneType = gameState?.currentScene?.type;
    const sceneProps = {
        socket, name, gameState, history,
        token: localStorage.getItem('player_token')
    };

    return (
        <div className="app-container">
            {!isConnected && (
                <ConnectionErrorOverlay
                    ui={ui} countdown={countdown}
                    onRefresh={() => window.location.reload()}
                />
            )}

            <div className="main-content">
                {/* --- LEADERBOARD OVERLAY --- */}
                {showPoints && isScoreVisible && (
                    <Leaderboard scores={gameState.scores} ui={ui} />
                )}

                <div className={`card ${animateScore ? (scoreDiff > 0 ? 'score-pop-up' : 'score-pop-down') : ''}`}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h3 style={{ margin: 0 }}>{name}</h3>

                            {/* --- SCORE BADGE --- */}
                            {showPoints && (
                                <div style={{ position: 'relative' }}>
                                    <span className={`score-badge ${animateScore ? 'animate' : ''}`}>
                                        {myScore} pts
                                    </span>

                                    {/* FLOATING TEXT: Displays +X or -X based on change */}
                                    {scoreDiff !== null && (
                                        <span className={`score-floating-text ${scoreDiff > 0 ? 'positive' : 'negative'}`}>
                                            {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="status-dot" style={{
                            background: isConnected ? '#2ecc71' : '#e74c3c',
                            width: 10, height: 10, borderRadius: '50%'
                        }}></div>
                    </header>
                    <hr />
                    {(() => {
                        switch (sceneType) {
                            case 'PROPOSAL': return <ProposalScene {...sceneProps} />;
                            case 'WAITING':  return <WaitingScene {...sceneProps} />;
                            default: return (
                                <div style={{textAlign:'center', padding:'20px'}}>
                                    {t(ui, 'WAITING_FOR_START')}
                                </div>
                            );
                        }
                    })()}
                </div>
            </div>

            <Footer version={gameState?.version} ui={ui} />
        </div>
    );
};

export default PublicView;