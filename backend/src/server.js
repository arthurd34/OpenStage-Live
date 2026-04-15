require('dotenv').config();
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const dbManager = require('./db');
const sceneManager = require('./scenes');
const adminManager = require('./admin');
const ShowManager = require('./showManager');
const translations = require("./i18n");
const proposal = require('./scenes/proposal');

// --- VERSION CONFIGURATION ---
const VERSION = "1.0-beta.1";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {cors: {origin: "*"}});

// --- CONFIGURATION CORS ---
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "x-admin-token"]
}));

app.use(fileUpload());

// --- SERVE STATIC FILES (SHOW ASSETS) ---
app.use('/shows', express.static(path.join(__dirname, '..', 'shows')));

// --- INITIAL STATE & PERSISTENCE ---
const savedState = dbManager.loadState();
let state = savedState || {
    activeShowId: null,
    isLive: false,
    currentSceneIndex: 0,
    activeUsers: [],
    pendingRequests: [],
    allProposals: [],
    adminTokens: [],
    allowNewJoins: true,
    accessConfig: {
        mode: 'PUBLIC',
        publicCode: '1234',
        whitelist: []
    },
    scores: {},
    isScoreVisible: false,
    activePreset: null
};

// Migration guards for state loaded from older versions
if (!state.adminTokens)   state.adminTokens = [];
if (!state.accessConfig)  state.accessConfig = { mode: 'PUBLIC', publicCode: '1234', whitelist: [] };
if (!state.scores)        state.scores = {};
if (state.isScoreVisible  === undefined) state.isScoreVisible = false;
if (state.activePreset    === undefined) state.activePreset = null;

let showConfig = {
    name: "No show loaded",
    lang: "fr",
    hasPoints: false,
    scenes: [{id: 'OFFLINE', title: "Offline", type: "WAITING", params: {}}]
};

const persist = () => dbManager.saveState(state);

// --- SHOW MANAGEMENT HELPERS ---
const loadShowConfig = (showId) => {
    try {
        const configPath = path.join(__dirname, '..', 'shows', showId, 'config.json');
        if (fs.existsSync(configPath)) {
            showConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`[ShowManager] Loaded: ${showConfig.name}`);
        }
    } catch (err) {
        console.error(`[ShowManager] Error loading config for ${showId}:`, err);
    }
};

if (state.activeShowId) loadShowConfig(state.activeShowId);

// --- SYNC DATA ---
const getSyncData = () => {
    let playlist = [...showConfig.scenes];

    if (showConfig.hasPoints) {
        playlist.push({
            id: 'AUTO_LEADERBOARD',
            title: "🏆 " + (translations[showConfig.lang]?.ADMIN_SCORES_TITLE || "Classement"),
            type: 'LEADERBOARD',
            params: {}
        });
    }

    const base = {
        isLive: state.isLive,
        activeShowId: state.activeShowId,
        version: VERSION,
        ui: translations[showConfig.lang] || translations['fr'],
        allowNewJoins: state.allowNewJoins,
        accessMode: state.accessConfig.mode,
        showName: showConfig.name || '',
        hasPoints: showConfig.hasPoints || false,
        scores: state.scores,
        isScoreVisible: state.isScoreVisible,
        allProposals: state.allProposals,
        activePreset: state.activePreset,
        assets: showConfig.assets || [],
        theme: showConfig.theme || {},
        currentIndex: state.currentSceneIndex,
        playlist,
        accessConfig: state.accessConfig
    };

    if (!state.isLive) {
        return { ...base, currentScene: { id: 'OFFLINE', type: 'WAITING', params: { titleDisplay: "SHOW_NOT_STARTED" } } };
    }

    return { ...base, currentScene: playlist[state.currentSceneIndex] || playlist[0] };
};

const isValidAdmin = (token) => state.adminTokens && state.adminTokens.includes(token);

const refreshAdminLists = () => {
    io.to('admin_room').emit('admin_user_list', state.activeUsers);
    io.to('admin_room').emit('admin_pending_list', state.pendingRequests);
    io.to('admin_room').emit('sync_state', getSyncData());
};

// --- SHARED HELPERS ---

/** persist + broadcast sync_state to all + optional extras */
const broadcastUpdate = ({ withProposals = false, withUserHistory = false } = {}) => {
    persist();
    io.emit('sync_state', getSyncData());
    if (withProposals)   io.to('admin_room').emit('admin_sync_proposals', state.allProposals);
    if (withUserHistory) io.emit('user_history_update', []);
    refreshAdminLists();
};

/** Clear proposals, active preset and per-user proposal history (no persist) */
const clearProposals = () => {
    state.allProposals = [];
    state.activePreset = null;
    state.activeUsers.forEach(u => { u.proposals = []; });
};

/** Emit the full initial admin data set to a freshly authenticated socket */
const setupAdminSession = (socket, token) => {
    socket.join('admin_room');
    socket.emit('login_success', { token });
    socket.emit('sync_state', getSyncData());
    refreshAdminLists();
    socket.emit('admin_sync_proposals', state.allProposals);
    socket.emit('admin_joins_status', state.allowNewJoins);
    socket.emit('admin_live_status', state.isLive);
};

/** Emit approval events to a player's socket */
const approveUserOnSocket = (socket, user) => {
    socket.emit('status_update', { status: 'approved', name: user.name, token: user.token });
    socket.emit('sync_state', getSyncData());
    socket.emit('user_history_update', user.proposals || []);
    refreshAdminLists();
};

// --- CONTEXT FACTORY ---
const getContext = () => ({
    currentScene: showConfig.scenes[state.currentSceneIndex],
    version: VERSION,
    ...state,
    refreshAdminLists,
    getSyncData,
    setAllProposals: (val) => { state.allProposals = val; persist(); },
    setActiveUsers:  (val) => { state.activeUsers  = val; persist(); },
    setPendingRequests: (val) => { state.pendingRequests = val; persist(); },
    setAccessConfig: (val) => { state.accessConfig = val; persist(); },
    setActivePreset: (val) => { state.activePreset = val; persist(); }
});

const adminAction = (callback) => (data) => {
    if (data && data.token && isValidAdmin(data.token)) {
        callback(data);
    } else {
        console.warn("Unauthorized admin action attempt blocked.");
    }
};

// --- HTTP ROUTES ---

app.post('/admin/upload-show', async (req, res) => {
    const token = req.headers['x-admin-token'];
    if (!isValidAdmin(token)) return res.status(401).send('Unauthorized');

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files uploaded');
    }

    try {
        const uploadedFile = Object.values(req.files)[0];
        if (!uploadedFile.name.endsWith('.zip')) {
            return res.status(400).send('Only ZIP files are allowed');
        }
        const showId = await ShowManager.uploadShow(uploadedFile);
        res.send({ success: true, showId });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).send({ error: err.message });
    }
});

// --- SOCKET EVENTS ---

io.on('connection', (socket) => {
    socket.emit('sync_state', getSyncData());

    socket.on('ping_probe', () => socket.emit('pong_response'));

    socket.on('report_ping', (data) => {
        const user = state.activeUsers.find(u => u.socketId === socket.id);
        if (user) {
            user.ping = data.ping;
            refreshAdminLists();
        }
    });

    // --- ADMIN AUTH ---
    socket.on('admin_login', (data) => {
        const { password, token } = (typeof data === 'string') ? { password: data } : data;

        if (password && password === process.env.ADMIN_PASSWORD) {
            const newToken = crypto
                .createHmac('sha256', process.env.SECRET_TOKEN)
                .update(crypto.randomBytes(16))
                .digest('hex');
            state.adminTokens.push(newToken);
            if (state.adminTokens.length > 50) state.adminTokens.shift();
            persist();
            setupAdminSession(socket, newToken);
            return;
        }

        if (token && isValidAdmin(token)) {
            setupAdminSession(socket, token);
            return;
        }

        socket.emit('login_error', 'ERROR_INVALID_CREDENTIALS');
    });

    socket.on('admin_update_access_config', adminAction((data) => {
        adminManager.updateAccessConfig(socket, io, data, getContext());
    }));

    // --- SCORING ---
    socket.on('admin_add_points', adminAction((data) => {
        if (!showConfig.hasPoints) return;
        const { playerName, amount } = data;
        if (!playerName) return;
        if (!state.scores[playerName]) state.scores[playerName] = 0;
        state.scores[playerName] += amount;
        broadcastUpdate();
    }));

    socket.on('admin_reset_scores', adminAction(() => {
        state.scores = {};
        broadcastUpdate();
    }));

    socket.on('admin_toggle_score_visibility', adminAction((data) => {
        state.isScoreVisible = data.value;
        broadcastUpdate();
    }));

    // --- PROPOSALS ---
    socket.on('send_proposal', (data) => {
        if (data && data.token && isValidAdmin(data.token)) data.isAdmin = true;
        proposal.send_proposal(socket, io, data, getContext());
    });

    socket.on('admin_set_proposal_winner', adminAction((data) => {
        proposal.admin_set_proposal_winner(socket, io, data, getContext());
    }));

    socket.on('admin_display_proposal', adminAction((data) => {
        proposal.admin_display_proposal(socket, io, data, getContext());
    }));

    socket.on('admin_approve_proposal', adminAction((data) => {
        proposal.admin_approve_proposal(socket, io, data, getContext());
    }));

    socket.on('admin_delete_proposal', adminAction((data) => {
        proposal.admin_delete_proposal(socket, io, data, getContext());
    }));

    socket.on('admin_clear_all_proposals', adminAction((data) => {
        proposal.admin_clear_all_proposals(socket, io, data, getContext());
    }));

    // --- SHOWS & SYSTEM ---
    socket.on('admin_get_shows', adminAction(async () => {
        socket.emit('admin_shows_list', await ShowManager.listShows());
    }));

    socket.on('admin_delete_show', adminAction(async (data) => {
        await ShowManager.deleteShow(data.showId);
        socket.emit('admin_shows_list', await ShowManager.listShows());
    }));

    socket.on('admin_load_show', adminAction((data) => {
        loadShowConfig(data.showId);
        state.activeShowId = data.showId;
        state.currentSceneIndex = 0;
        state.isLive = false;
        clearProposals();
        broadcastUpdate({ withProposals: true, withUserHistory: true });
    }));

    socket.on('admin_toggle_live', adminAction((data) => {
        state.isLive = data.value;

        if (state.isLive) {
            state.currentSceneIndex = 0;
        } else {
            state.activeUsers = [];
            state.pendingRequests = [];
            state.scores = {};
            clearProposals();
            state.accessConfig.whitelist.forEach(c => { c.used = false; c.playerName = ''; });
            io.emit('status_update', {
                status: 'session_expired',
                reason: "Le spectacle est terminé. Merci de votre participation !"
            });
        }

        broadcastUpdate({ withProposals: true });
    }));

    socket.on('admin_toggle_joins', adminAction((data) => {
        state.allowNewJoins = data.value;
        persist();
        io.to('admin_room').emit('admin_joins_status', state.allowNewJoins);
        refreshAdminLists();
    }));

    socket.on('admin_approve_user', adminAction((data) => adminManager.approveUser(socket, io, data, getContext())));
    socket.on('admin_kick_user',    adminAction((data) => adminManager.kickUser(socket, io, data, getContext())));
    socket.on('admin_rename_user',  adminAction((data) => adminManager.renameUser(socket, io, data, getContext())));

    socket.on('admin_set_scene', adminAction((data) => {
        state.currentSceneIndex = data.index;
        clearProposals();
        broadcastUpdate({ withProposals: true, withUserHistory: true });
    }));

    // --- JOIN & DISCONNECT ---
    socket.on('join_request', (data) => {
        if (!state.isLive && !data.isReconnect) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_SHOW_NOT_STARTED" });
        }

        // Reconnection with existing token
        if (data.isReconnect && data.token) {
            const existingUser = state.activeUsers.find(u => u.token === data.token);
            if (existingUser) {
                existingUser.socketId = socket.id;
                existingUser.connected = true;
                persist();
                approveUserOnSocket(socket, existingUser);
            } else {
                socket.emit('status_update', { status: 'session_expired', reason: "ERROR_SESSION_EXPIRED" });
            }
            return;
        }

        if (!state.allowNewJoins) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_JOINS_CLOSED" });
        }

        const rawName = data.name ? data.name.trim() : "";
        if (!rawName) return;
        if (rawName.length > 25) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_NAME_TOO_LONG", transData: { max: 25 } });
        }

        const entryCode = data.entryCode ? data.entryCode.trim().toUpperCase() : "";

        // Access mode: PUBLIC
        if (state.accessConfig.mode === 'PUBLIC') {
            if (entryCode !== state.accessConfig.publicCode.toUpperCase()) {
                return socket.emit('status_update', { status: 'rejected', reason: "ERROR_INVALID_CODE" });
            }
        }
        // Access mode: WHITELIST
        else if (state.accessConfig.mode === 'WHITELIST') {
            const codeObj = state.accessConfig.whitelist.find(c => c.code === entryCode);

            if (!codeObj) {
                return socket.emit('status_update', { status: 'rejected', reason: "ERROR_INVALID_CODE" });
            }

            if (codeObj.used) {
                const occupant = state.activeUsers.find(u => u.entryCode === entryCode);
                if (occupant) {
                    if (occupant.connected) {
                        return socket.emit('status_update', { status: 'rejected', reason: "ERROR_CODE_ALREADY_USED" });
                    }
                    // Takeover: disconnected user reclaims their slot
                    occupant.socketId = socket.id;
                    occupant.token = crypto.randomBytes(16).toString('hex');
                    occupant.connected = true;
                    persist();
                    approveUserOnSocket(socket, occupant);
                    return;
                }
            }

            // Mark code as used
            codeObj.used = true;
            codeObj.playerName = rawName;
        }

        const nameLower = rawName.toLowerCase();
        const isNameTaken =
            state.activeUsers.some(u => u.name.toLowerCase() === nameLower) ||
            state.pendingRequests.some(r => r.name.toLowerCase() === nameLower);

        if (isNameTaken) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_NAME_TAKEN" });
        }

        const userToken = crypto.randomBytes(16).toString('hex');
        const req = { socketId: socket.id, name: rawName, token: userToken, connected: true, proposals: [], entryCode, score: 0 };

        state.pendingRequests.push(req);
        persist();
        socket.emit('status_update', { status: 'pending', token: userToken });
        io.to('admin_room').emit('admin_new_request', req);
        refreshAdminLists();
    });

    socket.on('disconnect', () => {
        const user = state.activeUsers.find(u => u.socketId === socket.id);
        if (user) { user.connected = false; persist(); }

        const wasPending = state.pendingRequests.some(r => r.socketId === socket.id);
        if (wasPending) {
            state.pendingRequests = state.pendingRequests.filter(r => r.socketId !== socket.id);
            persist();
        }

        refreshAdminLists();
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`
=============================================
   OPEN STAGE LIVE - Version ${VERSION}
=============================================
   Server Ready on port ${process.env.PORT || 3000}
   Mode: ${process.env.NODE_ENV || 'development'}
=============================================
    `);
});
