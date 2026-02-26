import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { t } from '../utils/i18n';

// Sub-components
import AdminHeader from '../components/admin/AdminHeader';
import ShowLibrary from '../components/admin/ShowLibrary';
import AccessControl from '../components/admin/AccessControl';
import SceneControl from '../components/admin/SceneControl';
import UserManagement from '../components/admin/UserManagement';
import ScoringSystem from '../components/admin/ScoringSystem';
import Footer from "../components/Footer.jsx";

const socketUrl = import.meta.env.VITE_BACKEND_URL;
const socket = io(socketUrl, { transports: ["websocket"] });

const AdminView = () => {
    // --- AUTH & SESSION STATE ---
    const [auth, setAuth] = useState(false);
    const [pass, setPass] = useState('');
    const [token, setToken] = useState(localStorage.getItem('admin_token'));
    const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('admin_token'));

    // --- GAME DATA STATE ---
    const [state, setState] = useState(null);
    const [requests, setRequests] = useState([]);
    const [users, setUsers] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [allowJoins, setAllowJoins] = useState(true);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [availableShows, setAvailableShows] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // --- MONITORING STATE ---
    const [ping, setPing] = useState(0);

    const fileInputRef = useRef(null);
    const newCodeInputRef = useRef(null);

    // Derived state
    const ui = state?.ui || {};
    const accessConfig = state?.accessConfig || { mode: 'PUBLIC', publicCode: '', whitelist: [] };

    // --- SECURE EMIT HELPER ---
    const emitAdmin = useCallback((event, data = {}) => {
        socket.emit(event, { ...data, token });
    }, [token]);

    // --- EFFECT: LATENCY MONITORING (PING) ---
    useEffect(() => {
        let pingStart;

        const interval = setInterval(() => {
            if (socket.connected && auth) {
                pingStart = Date.now();
                socket.emit('ping_probe');
            }
        }, 3000);

        socket.on('pong_response', () => {
            setPing(Date.now() - pingStart);
        });

        return () => {
            clearInterval(interval);
            socket.off('pong_response');
        };
    }, [auth]);

    useEffect(() => {
        // Handle successful login
        socket.on('login_success', (data) => {
            setAuth(true);
            setToken(data.token);
            if (localStorage.getItem('admin_remember') === 'true') {
                localStorage.setItem('admin_token', data.token);
            }
            socket.emit('admin_get_shows', { token: data.token });
        });

        // Handle login errors
        socket.on('login_error', (msg) => {
            alert(t(ui, msg) || msg);
            localStorage.removeItem('admin_token');
            setAuth(false);
        });

        // Global state sync
        socket.on('sync_state', (s) => {
            setState(s);
            if (s.allowNewJoins !== undefined) setAllowJoins(s.allowNewJoins);
        });

        // Data listeners
        socket.on('admin_shows_list', setAvailableShows);
        socket.on('admin_pending_list', setRequests);
        socket.on('admin_user_list', setUsers);
        socket.on('admin_sync_proposals', setProposals);

        // Connection status
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        // Auto-login attempt
        if (token && !auth) socket.emit('admin_login', { token });

        return () => {
            socket.off('login_success');
            socket.off('login_error');
            socket.off('sync_state');
            socket.off('admin_shows_list');
            socket.off('admin_pending_list');
            socket.off('admin_user_list');
            socket.off('admin_sync_proposals');
            socket.off('connect');
            socket.off('disconnect');
        };
    }, [auth, token, ui]);

    // --- ACTION HANDLERS ---
    const handleLogin = (e) => {
        e.preventDefault();
        localStorage.setItem('admin_remember', rememberMe);
        socket.emit('admin_login', { password: pass });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('showZip', file);
        try {
            const response = await fetch(`${socketUrl}/admin/upload-show`, {
                method: 'POST',
                body: formData,
                headers: { 'x-admin-token': token }
            });
            if (response.ok) {
                emitAdmin('admin_get_shows');
                alert(t(ui, 'ADMIN_UPLOAD_SUCCESS'));
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const updateAccessConfig = (newCfg) => {
        emitAdmin('admin_update_access_config', {
            accessConfig: { ...accessConfig, ...newCfg }
        });
    };

    const addWhitelistCode = () => {
        const code = newCodeInputRef.current.value.trim().toUpperCase();
        if (!code) return;
        const newList = [...accessConfig.whitelist, { code, used: false, playerName: '' }];
        updateAccessConfig({ whitelist: newList });
        newCodeInputRef.current.value = "";
    };

    /**
     * Specific handler for the Live Mode toggle
     * with confirmation prompt when disabling.
     */
    const handleToggleLive = (requestedValue) => {
        if (requestedValue === false) {
            // Confirm ending the show
            const confirmEnd = window.confirm("Voulez-vous mettre fin au spectacle ? (Cela expulsera tout le monde)");
            if (!confirmEnd) return;
        }
        emitAdmin('admin_toggle_live', { value: requestedValue });
    };

    // --- RENDER: LOGIN ---
    if (!auth) return (
        <div className="card" style={{ maxWidth: '400px', margin: '100px auto' }}>
            <h2>{t(ui, 'ADMIN_LOGIN_TITLE')}</h2>
            <form onSubmit={handleLogin}>
                <input
                    type="password"
                    placeholder={t(ui, 'ADMIN_INPUT_PASS_PH')}
                    onChange={e => setPass(e.target.value)}
                    autoFocus
                    className="admin-input"
                />
                <div className="remember-container">
                    <span>{t(ui, 'ADMIN_REMEMBER_ME')}</span>
                    <label className="switch">
                        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                        <span className="slider round"></span>
                    </label>
                </div>
                <button className="btn-primary" style={{ width: '100%' }} type="submit">
                    {t(ui, 'ADMIN_BTN_LOGIN')}
                </button>
            </form>
        </div>
    );

    // --- RENDER: DASHBOARD ---
    return (
        <div className="app-container">
            {!isConnected && <div className="connexion-error-banner">⚠️ {t(ui, 'CONNECTION_LOST')}</div>}

            <div style={{ opacity: isConnected ? 1 : 0.5 }}>
                <AdminHeader
                    state={state}
                    ui={ui}
                    ping={ping}
                    onLogout={() => {
                        localStorage.removeItem('admin_token');
                        window.location.reload();
                    }}
                />

                <div className="admin-grid">
                    <ShowLibrary
                        state={state}
                        availableShows={availableShows}
                        isUploading={isUploading}
                        isLive={state?.isLive}
                        ui={ui}
                        onLoad={(id) => emitAdmin('admin_load_show', { showId: id })}
                        onDelete={(id) => window.confirm(t(ui, 'ADMIN_CONFIRM_DELETE')) && emitAdmin('admin_delete_show', { showId: id })}
                        onUpload={handleFileUpload}
                        fileInputRef={fileInputRef}
                        emitAdmin={(event, data) => {
                            if (event === 'admin_toggle_live') {
                                handleToggleLive(data.value);
                            } else {
                                emitAdmin(event, data);
                            }
                        }}
                    />

                    <AccessControl
                        state={state}
                        allowJoins={allowJoins}
                        accessConfig={accessConfig}
                        ui={ui}
                        onToggleJoins={() => emitAdmin('admin_toggle_joins', { value: !allowJoins })}
                        onUpdateConfig={updateAccessConfig}
                        onAddCode={addWhitelistCode}
                        onRemoveCode={(code) => updateAccessConfig({ whitelist: accessConfig.whitelist.filter(c => c.code !== code) })}
                        newCodeInputRef={newCodeInputRef}
                    />

                    {/* Scoring System with visibility toggle */}
                    <ScoringSystem
                        state={state}
                        users={users}
                        ui={ui}
                        onAddPoints={(name, amount) => emitAdmin('admin_add_points', { playerName: name, amount })}
                        onReset={() => emitAdmin('admin_reset_scores')}
                        onToggleVisibility={(val) => emitAdmin('admin_toggle_score_visibility', { value: val })}
                    />
                </div>

                <UserManagement
                    requests={requests}
                    users={users}
                    ui={ui}
                    onApprove={(id) => emitAdmin('admin_approve_user', { socketId: id })}
                    onKick={(id, isRefusal) => {
                        const reason = prompt(t(ui, isRefusal ? 'ADMIN_PROMPT_REFUSE_REASON' : 'ADMIN_PROMPT_KICK_REASON'));
                        if (reason !== null) emitAdmin('admin_kick_user', { socketId: id, reason, isRefusal });
                    }}
                    onRename={(id, oldName) => {
                        const newName = prompt(t(ui, 'ADMIN_PROMPT_RENAME'), oldName);
                        if (newName) emitAdmin('admin_rename_user', { socketId: id, newName });
                    }}
                />

                {/* Playlist Navigation */}
                <div className="card" style={{
                    transition: 'all 0.3s ease',
                    borderTop: `4px solid ${state?.isLive ? '#22c55e' : '#ef4444'}`,
                    backgroundColor: state?.isLive ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
                }}>
                    <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {t(ui, 'ADMIN_CURRENT_SCENE_LABEL')}
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: state?.isLive ? '#22c55e' : '#ef4444',
                            color: 'white',
                            textTransform: 'uppercase'
                        }}>
                            {state?.isLive ? 'Live' : 'Offline'}
                        </span>
                    </h3>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                        {state?.playlist?.map((act, i) => (
                            <button
                                key={act.id}
                                className={state.currentIndex === i ? "btn-primary" : ""}
                                onClick={() => emitAdmin('admin_set_scene', { index: i })}
                            >
                                {act.title}
                            </button>
                        ))}
                    </div>
                </div>

                <SceneControl
                    currentScene={state?.currentScene}
                    proposals={proposals}
                    socket={socket}
                    token={token}
                    emitAdmin={emitAdmin}
                    ui={ui}
                    isLive={state?.isLive}
                />
            </div>
            <Footer version={state?.version} ui={ui} />
        </div>
    );
};

export default AdminView;