import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import LeaderboardScreen from '../components/screen/LeaderboardScreen';
import ProposalsScreen from '../components/screen/ProposalsScreen';

const socketUrl = import.meta.env.VITE_BACKEND_URL;
const socket = io(socketUrl, { transports: ["websocket"] });

const ScreenView = () => {
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        socket.on('sync_state', (state) => setGameState(state));
        return () => socket.off('sync_state');
    }, []);

    if (!gameState) return (
        <div style={{ backgroundColor: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Initializing...
        </div>
    );

    // --- LOGIC ---
    // 1. Check if the current scene is a Leaderboard type (auto-injected or manual)
    const isLeaderboardScene = gameState.currentScene?.type === 'LEADERBOARD';

    // 2. Filter broadcasted proposals
    const displayedProposals = gameState?.allProposals?.filter(p => p.isDisplayed) || [];

    return (
        <div style={{
            height: '100vh', width: '100vw', display: 'flex', position: 'absolute',
            top: 0, left: 0, flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', backgroundColor: '#000', color: '#fff',
            fontFamily: 'sans-serif', overflow: 'hidden', margin: 0, padding: 0
        }}>

            {/* --- SWITCHER --- */}
            {isLeaderboardScene ? (
                /* The Leaderboard is now triggered by the scene navigation */
                <LeaderboardScreen scores={gameState.scores} />
            ) : displayedProposals.length > 0 ? (
                /* Proposals take priority if no leaderboard scene is active */
                <ProposalsScreen proposals={displayedProposals} />
            ) : (
                /* --- DEFAULT SCENE (LOGO OR TITLE) --- */
                <div style={{ textAlign: 'center', width: '100%', animation: 'fadeIn 1s ease' }}>
                    {gameState.currentScene?.type === 'WAITING' ? (
                        <h1 style={{ fontSize: '10rem', color: '#00d4ff', textShadow: '0 0 60px rgba(0,212,255,0.6)' }}>
                            OPEN STAGE LIVE
                        </h1>
                    ) : (
                        <div style={{ padding: '0 50px' }}>
                            <h1 style={{ fontSize: '7rem', margin: 0, textTransform: 'uppercase' }}>
                                {gameState.currentScene?.title}
                            </h1>
                            <div style={{ width: '40vw', height: '8px', background: '#00d4ff', margin: '40px auto' }}></div>
                        </div>
                    )}
                </div>
            )}

            <style>
                {`
                    body { margin: 0; padding: 0; background-color: black; }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                `}
            </style>
        </div>
    );
};

export default ScreenView;