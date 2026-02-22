import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import SceneControl from '../components/admin/SceneControl';
import { t } from '../utils/i18n';
import Footer from "../components/Footer.jsx";

const socketUrl = import.meta.env.VITE_BACKEND_URL;
const socket = io(socketUrl, {
    transports: ["websocket"],
});

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
    const [isLive, setIsLive] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);

    // --- SHOWS MANAGEMENT STATE ---
    const [availableShows, setAvailableShows] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const ui = state?.ui || {};

    // --- SECURE EMIT HELPER ---
    const emitAdmin = useCallback((event, data = {}) => {
        socket.emit(event, { ...data, token });
    }, [token]);

    useEffect(() => {
        // --- AUTH LISTENERS ---
        socket.on('login_success', (data) => {
            console.log("URL IS :"+ import.meta.env.VITE_BACKEND_URL);
            setAuth(true);
            setToken(data.token);
            if (localStorage.getItem('admin_remember') === 'true') {
                localStorage.setItem('admin_token', data.token);
            }
            socket.emit('admin_get_shows', { token: data.token });
        });

        socket.on('login_error', (msg) => {
            alert(t(ui, msg) || msg);
            handleLogout();
        });

        if (token && !auth) {
            socket.emit('admin_login', { token });
        }

        // --- GLOBAL SYNC LISTENERS ---
        socket.on('sync_state', (s) => {
            setState(s);
            if (s.isLive !== undefined) setIsLive(s.isLive);
        });

        socket.on('admin_shows_list', (list) => setAvailableShows(list));
        socket.on('admin_pending_list', (list) => setRequests(list));
        socket.on('admin_user_list', (list) => setUsers(list));
        socket.on('admin_new_request', (newReq) => setRequests(prev => [...prev, newReq]));
        socket.on('admin_joins_status', (status) => setAllowJoins(status));
        socket.on('admin_sync_proposals', (list) => setProposals(list));
        socket.on('admin_live_status', (status) => setIsLive(status));

        const onConnect = () => {
            setIsConnected(true);
            const saved = localStorage.getItem('admin_token');
            if (saved) socket.emit('admin_login', { token: saved });
        };
        const onDisconnect = () => setIsConnected(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('login_success');
            socket.off('login_error');
            socket.off('sync_state');
            socket.off('admin_shows_list');
            socket.off('admin_pending_list');
            socket.off('admin_user_list');
            socket.off('admin_new_request');
            socket.off('admin_joins_status');
            socket.off('admin_sync_proposals');
            socket.off('admin_live_status');
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [auth, token, ui]);

    // --- ACTION HANDLERS ---
    const handleLogin = (e) => {
        e.preventDefault();
        localStorage.setItem('admin_remember', rememberMe);
        socket.emit('admin_login', { password: pass });
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_remember');
        window.location.reload();
    };

    const handleKick = (id, isRefusal = false) => {
        const promptMsg = isRefusal ? 'ADMIN_PROMPT_REFUSE_REASON' : 'ADMIN_PROMPT_KICK_REASON';
        const reason = prompt(t(ui, promptMsg));
        if (reason !== null) emitAdmin('admin_kick_user', { socketId: id, reason, isRefusal });
    };

    // --- ZIP UPLOAD HANDLER ---
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
            } else {
                alert(t(ui, 'ADMIN_UPLOAD_ERROR'));
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // --- RENDER: LOGIN ---
    if (!auth) return (
        <div className="card" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
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
            {!isConnected && (
                <div className="connexion-error-banner">
                    ⚠️ {t(ui, 'CONNECTION_LOST')}
                    <button onClick={() => window.location.reload()} className="btn-primary">
                        {t(ui, 'BTN_REFRESH')}
                    </button>
                </div>
            )}

            <div style={{ opacity: isConnected ? 1 : 0.5, pointerEvents: isConnected ? 'all' : 'none' }}>
                <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    padding: '10px 20px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px'
                }}>
                    <div>
                        <h1 style={{ margin: 0 }}>{t(ui, 'ADMIN_DASHBOARD_TITLE')}</h1>
                        {/* ACTIVE SHOW INDICATOR */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: state?.activeShowId ? '#22c55e' : '#ef4444'
                            }}></span>
                            <small style={{ opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {state?.activeShowId ? `Pack: ${state.activeShowId}` : t(ui, 'ADMIN_NO_SHOW_LOADED')}
                            </small>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="btn-danger">{t(ui, 'ADMIN_BTN_LOGOUT')}</button>
                </header>

                <div className="admin-grid">
                    {/* SHOWS LIBRARY & CONFIG */}
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
                                        <div
                                            key={showId}
                                            className="user-row"
                                            style={{
                                                border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                                                background: isActive ? 'rgba(0, 212, 255, 0.05)' : 'rgba(255,255,255,0.02)'
                                            }}
                                        >
                                            <span style={{ color: isActive ? 'var(--primary)' : 'inherit', fontWeight: isActive ? 'bold' : 'normal' }}>
                                                {showId} {isActive && "✓"}
                                            </span>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                {/* Only show Load button if NOT active */}
                                                {!isActive && (
                                                    <button onClick={() => emitAdmin('admin_load_show', { showId })}>
                                                        {t(ui, 'ADMIN_BTN_LOAD')}
                                                    </button>
                                                )}
                                                <button className="btn-danger" onClick={() => {
                                                    if (window.confirm(t(ui, 'ADMIN_CONFIRM_DELETE'))) emitAdmin('admin_delete_show', { showId });
                                                }}>🗑</button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {availableShows.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>{t(ui, 'ADMIN_EMPTY_LIST')}</p>}
                            </div>
                        </div>

                        {/* ZIP Upload Button */}
                        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '15px', marginBottom: '20px' }}>
                            <input type="file" accept=".zip" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                            <button className="btn-primary" style={{ width: '100%' }} onClick={() => fileInputRef.current.click()} disabled={isUploading}>
                                {isUploading ? t(ui, 'ADMIN_UPLOADING') : t(ui, 'ADMIN_BTN_UPLOAD_ZIP')}
                            </button>
                        </div>

                        {/* Live Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: isLive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: `1px solid ${isLive ? 'var(--success)' : 'transparent'}` }}>
                            <div>
                                <h4 style={{ margin: 0 }}>{t(ui, 'ADMIN_LIVE_MODE')}</h4>
                                <small style={{ opacity: 0.7 }}>{isLive ? t(ui, 'ADMIN_LIVE_ON') : t(ui, 'ADMIN_LIVE_OFF')}</small>
                            </div>
                            <label className="switch">
                                <input type="checkbox" checked={isLive} onChange={(e) => emitAdmin('admin_toggle_live', { value: e.target.checked })} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </section>

                    {/* ACCESS CONTROL */}
                    <section className="card">
                        <h3>{t(ui, 'ADMIN_ACCESS_CONTROL')}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <label className="switch">
                                    <input type="checkbox" checked={allowJoins} onChange={() => emitAdmin('admin_toggle_joins', { value: !allowJoins })} />
                                    <span className="slider round"></span>
                                </label>
                                <h4 style={{ margin: 0 }}>{allowJoins ? t(ui, 'ADMIN_JOINS_OPEN') : t(ui, 'ADMIN_JOINS_CLOSED')}</h4>
                            </div>
                        </div>
                    </section>
                </div>

                {/* SCENE NAVIGATION */}
                <div className="card">
                    <h3>{t(ui, 'ADMIN_CURRENT_SCENE_LABEL')}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
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

                {/* USERS MANAGEMENT */}
                <div className="admin-grid">
                    <section className="card">
                        <h3>{t(ui, 'ADMIN_TITLE_REQUESTS', { count: requests.length })}</h3>
                        {requests.map(r => (
                            <div key={r.socketId} className="user-row">
                                <strong>{r.name}</strong>
                                <div>
                                    <button onClick={() => emitAdmin('admin_approve_user', { socketId: r.socketId })}>{t(ui, 'ADMIN_BTN_APPROVE')}</button>
                                    <button className="btn-danger" onClick={() => handleKick(r.socketId, true)}>X</button>
                                </div>
                            </div>
                        ))}
                    </section>

                    <section className="card">
                        <h3>{t(ui, 'ADMIN_TITLE_PLAYERS', { count: users.length })}</h3>
                        {users.map(u => (
                            <div key={u.socketId} className="user-row">
                                <span style={{ color: u.connected ? '#22c55e' : '#ef4444' }}>● {u.name}</span>
                                <div>
                                    <button onClick={() => {
                                        const newName = prompt(t(ui, 'ADMIN_PROMPT_RENAME'), u.name);
                                        if (newName) emitAdmin('admin_rename_user', { socketId: u.socketId, newName });
                                    }}>{t(ui, 'ADMIN_BTN_EDIT')}</button>
                                    <button className="btn-danger" onClick={() => handleKick(u.socketId, false)}>{t(ui, 'ADMIN_BTN_KICK')}</button>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>

                <SceneControl
                    currentScene={state?.currentScene}
                    proposals={proposals}
                    socket={socket}
                    token={token}
                    emitAdmin={emitAdmin}
                    ui={ui}
                />
            </div>
            <Footer version={state?.version} ui={ui} />
        </div>
    );
};

export default AdminView;