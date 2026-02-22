// src/components/admin/SceneControl.jsx
import React from 'react';
import ProposalAdmin from './ProposalAdmin';
import { t } from '../../utils/i18n';

const SceneControl = ({ currentScene, proposals, socket, token, emitAdmin, ui }) => {
    if (!currentScene) return null;

    // --- RENDER BY SCENE TYPE ---
    switch (currentScene.type) {
        case 'PROPOSAL':
            return (
                <ProposalAdmin
                    proposals={proposals}
                    socket={socket}
                    token={token}
                    emitAdmin={emitAdmin}
                    ui={ui}
                />
            );

        default:
            return (
                <div className="card" style={{ textAlign: 'center', opacity: 0.5 }}>
                    {t(ui, 'ADMIN_NO_CONTROLS_FOR_SCENE', { name: currentScene.title ?? currentScene.type })}
                </div>
            );
    }
};

export default SceneControl;