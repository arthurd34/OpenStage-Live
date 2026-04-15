import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import LeaderboardScreen from '../components/screen/LeaderboardScreen';
import ProposalsScreen from '../components/screen/ProposalsScreen';
import PromoScreen from '../components/screen/PromoScreen';
import { useAssetPreloader } from '../utils/useAssetPreloader';
import { useCustomTheme } from '../utils/useCustomTheme';

const socketUrl = import.meta.env.VITE_BACKEND_URL;
const socket = io(socketUrl, { transports: ["websocket"] });

const ScreenView = () => {
    const [gameState, setGameState] = useState(null);
    const [manualWinner, setManualWinner] = useState(null);

    // --- SYSTEM HOOKS ---
    useAssetPreloader(gameState);
    useCustomTheme(gameState);

    useEffect(() => {
        socket.on('sync_state', (state) => setGameState(state));
        socket.on('show_on_screen', (proposal) => {
            setManualWinner(proposal);
        });

        return () => {
            socket.off('sync_state');
            socket.off('show_on_screen');
        };
    }, []);

    useEffect(() => {
        setManualWinner(null);
    }, [gameState?.currentIndex]);

    // [comment] Helper to get full URL of an asset by ID
    const getAssetUrl = (assetId) => {
        if (!gameState || !gameState.assets || !assetId) return null;
        const asset = gameState.assets.find(a => a.id === assetId);
        if (!asset) return null;
        return `${import.meta.env.VITE_BACKEND_URL}/shows/${gameState.activeShowId}/${asset.url}`;
    };

    // --- CUSTOM HTML PARSER ---
    // [comment] Replaces placeholders like {{titleDisplay}} with real values from params
    const renderCustomHtml = (htmlString, params) => {
        if (!htmlString) return null;
        let finalHtml = htmlString;

        // Replace {{asset:ID}} with the actual asset URL
        finalHtml = finalHtml.replace(/\{\{asset:([^}]+)\}\}/g, (_, assetId) => {
            return getAssetUrl(assetId) || '';
        });

        Object.keys(params || {}).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalHtml = finalHtml.replace(regex, params[key]);
        });

        return (
            <div
                className="custom-scene-container"
                dangerouslySetInnerHTML={{ __html: finalHtml }}
                style={{ width: '100%', height: '100%', position: 'relative', zIndex: 5 }}
            />
        );
    };

    if (!gameState) return (
        <div style={{ backgroundColor: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{ fontSize: '4rem' }}>Loading Show...</h1>
        </div>
    );

    const scene = gameState.currentScene;
    const currentBgId = scene?.uiOverrides?.backgroundAsset;
    const backgroundUrl = getAssetUrl(currentBgId);

    const isLeaderboardScene = scene?.type === 'LEADERBOARD';
    const isPromoScene = scene?.type === 'PROMO';
    const displayedProposals = gameState?.allProposals?.filter(p => p.isDisplayed) || [];
    const customHtml = scene?.uiOverrides?.customHtml;

    return (
        <div className="screen-root" style={{
            backgroundColor: gameState?.theme?.backgroundColor || '#1a1a1a',
            backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
            backgroundSize: scene?.uiOverrides?.fit || 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            position: 'absolute',
            top: 0, left: 0,
            color: gameState?.theme?.textColor || '#ffffff',
            height: '100vh', width: '100vw',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>

            {/* --- PRIORITY 1: CUSTOM HTML (User Autonomy) --- */}
            {customHtml ? (
                renderCustomHtml(customHtml, scene.params)
            ) : (
                /* --- PRIORITY 2: STANDARD REACT COMPONENTS --- */
                <>
                    {isLeaderboardScene ? (
                        <LeaderboardScreen scores={gameState.scores} />
                    ) : isPromoScene ? (
                        <PromoScreen scene={scene} />
                    ) : manualWinner ? (
                        <ProposalsScreen proposals={[manualWinner]} />
                    ) : displayedProposals.length > 0 ? (
                        <ProposalsScreen proposals={displayedProposals} />
                    ) : (
                        /* --- DEFAULT FALLBACKS (Scenes like WAITING) --- */
                        <div style={{ textAlign: 'center', width: '100%', animation: 'fadeIn 1s ease', margin: 'auto' }}>
                            {scene?.type === 'WAITING' ? (
                                // [comment] Hide text if displayTextOnScreen is false in config.json
                                scene.params?.displayTextOnScreen !== false && (
                                    <>
                                        <h1 className="default-title" style={{ fontSize: '10rem', margin: 0 }}>
                                            {scene.params?.titleDisplay === "SHOW_NOT_STARTED" ? "OPEN STAGE LIVE" : (scene.params?.titleDisplay || "OPEN STAGE LIVE")}
                                        </h1>
                                        {scene.params?.subTitle && (
                                            <h2 className="default-subtitle" style={{ fontSize: '4rem', opacity: 0.8, marginTop: '20px' }}>{scene.params.subTitle}</h2>
                                        )}
                                    </>
                                )
                            ) : (
                                <div style={{ padding: '0 50px' }}>
                                    <h1 style={{ fontSize: '7rem', margin: 0, textTransform: 'uppercase' }}>
                                        {scene?.title}
                                    </h1>
                                    <div style={{ width: '40vw', height: '8px', background: '#00d4ff', margin: '40px auto' }}></div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* [comment] Minimal fallback styles, can be overridden by customCss */}
            <style>
                {`
                    body { margin: 0; padding: 0; background-color: black; }
                    .default-title { color: #00d4ff; text-shadow: 0 0 60px rgba(0,212,255,0.6); }
                    .custom-scene-container { animation: fadeIn 0.5s ease-out; }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                `}
            </style>
        </div>
    );
};

export default ScreenView;