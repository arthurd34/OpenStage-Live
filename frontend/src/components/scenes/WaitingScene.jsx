// src/components/scenes/WaitingScene.jsx
import React from 'react';
import { t } from '../../utils/i18n';

const WaitingScene = ({ gameState }) => {
    // UI dictionary sent by the server
    const { ui } = gameState;

    // Specific scene parameters from showConfig
    const params = gameState?.currentScene?.params ?? {};

    return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            {/* Priority:
                1. Custom parameter titleDisplay from config
                2. Translated default waiting title
            */}
            <h2 style={{ marginBottom: '15px' }}>
                {params.titleDisplay || t(ui, 'WAITING_DEFAULT_TITLE')}
            </h2>

            <p style={{ opacity: 0.7, fontSize: '1.1rem' }}>
                {params.subtitle || t(ui, 'WAITING_SUBTITLE')}
            </p>

            {/* Visual feedback for the audience */}
            <div
                className="spinner"
                style={{ marginTop: '30px', marginInline: 'auto' }}
            ></div>
        </div>
    );
};

export default WaitingScene;