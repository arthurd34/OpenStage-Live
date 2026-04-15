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

if (!state.adminTokens) state.adminTokens = [];
if (!state.accessConfig) {
    state.accessConfig = {mode: 'PUBLIC', publicCode: '1234', whitelist: []};
}
if (!state.scores) state.scores = {};
if (state.isScoreVisible === undefined) state.isScoreVisible = false;

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
            const fileData = fs.readFileSync(configPath, 'utf8');
            showConfig = JSON.parse(fileData);
            console.log(`[ShowManager] Loaded: ${showConfig.name}`);
        }
    } catch (err) {
        console.error(`[ShowManager] Error loading config for ${showId}:`, err);
    }
};

if (state.activeShowId) {
    loadShowConfig(state.activeShowId);
}

/**
 * Prepares synchronization data for clients.
 * Dynamic: Injects Leaderboard scene if hasPoints is true.
 */
const getSyncData = () => {
    let playlist = [...showConfig.scenes];

    // --- AUTO-INJECT LEADERBOARD SCENE ---
    if (showConfig.hasPoints) {
        playlist.push({
            id: 'AUTO_LEADERBOARD',
            title: "🏆 " + (translations[showConfig.lang]?.ADMIN_SCORES_TITLE || "Classement"),
            type: 'LEADERBOARD',
            params: {}
        });
    }

    const baseData = {
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
        theme: showConfig.theme || {}
    };

    if (!state.isLive) {
        return {
            ...baseData,
            accessConfig: state.accessConfig,
            currentScene: {id: 'OFFLINE', type: 'WAITING', params: {titleDisplay: "SHOW_NOT_STARTED"}},
            currentIndex: state.currentSceneIndex,
            playlist: playlist
        };
    }

    return {
        ...baseData,
        currentScene: playlist[state.currentSceneIndex] || playlist[0],
        currentIndex: state.currentSceneIndex,
        playlist: playlist,
        accessConfig: state.accessConfig
    };
};

const isValidAdmin = (token) => state.adminTokens && state.adminTokens.includes(token);

const refreshAdminLists = () => {
    io.to('admin_room').emit('admin_user_list', state.activeUsers);
    io.to('admin_room').emit('admin_pending_list', state.pendingRequests);
    io.to('admin_room').emit('sync_state', getSyncData());
};

const getContext = () => ({
    currentScene: showConfig.scenes[state.currentSceneIndex],
    version: VERSION,
    ...state,
    refreshAdminLists,
    getSyncData,
    setAllProposals: (val) => {
        state.allProposals = val;
        persist();
    },
    setActiveUsers: (val) => {
        state.activeUsers = val;
        persist();
    },
    setPendingRequests: (val) => {
        state.pendingRequests = val;
        persist();
    },
    setAccessConfig: (val) => {
        state.accessConfig = val;
        persist();
    },
    setActivePreset: (val) => {
        state.activePreset = val;
        persist();
    }
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
        res.send({success: true, showId});
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).send({error: err.message});
    }
});

// --- SOCKET EVENTS ---

io.on('connection', (socket) => {
    socket.emit('sync_state', getSyncData());

    // Latency probe handler
    socket.on('ping_probe', () => {
        socket.emit('pong_response');
    });

    // Update user ping in state when received from client
    socket.on('report_ping', (data) => {
        const user = state.activeUsers.find(u => u.socketId === socket.id);
        if (user) {
            user.ping = data.ping;
            // Optimization: only refresh admin lists every few seconds or on significant change
            // but for now, we keep it simple:
            refreshAdminLists();
        }
    });

    socket.on('admin_login', (data) => {
        const {password, token} = (typeof data === 'string') ? {password: data} : data;
        if (password && password === process.env.ADMIN_PASSWORD) {
            const newToken = crypto
                .createHmac('sha256', process.env.SECRET_TOKEN)
                .update(crypto.randomBytes(16))
                .digest('hex');
            state.adminTokens.push(newToken);
            if (state.adminTokens.length > 50) state.adminTokens.shift();
            persist();

            socket.join('admin_room');
            socket.emit('login_success', {token: newToken});
            socket.emit('sync_state', getSyncData());
            refreshAdminLists();
            socket.emit('admin_sync_proposals', state.allProposals);
            socket.emit('admin_joins_status', state.allowNewJoins);
            socket.emit('admin_live_status', state.isLive);
            return;
        }

        if (token && isValidAdmin(token)) {
            socket.join('admin_room');
            socket.emit('login_success', {token});
            socket.emit('sync_state', getSyncData());
            refreshAdminLists();
            socket.emit('admin_sync_proposals', state.allProposals);
            socket.emit('admin_joins_status', state.allowNewJoins);
            socket.emit('admin_live_status', state.isLive);
            return;
        }
        socket.emit('login_error', 'ERROR_INVALID_CREDENTIALS');
    });

    socket.on('admin_update_access_config', adminAction((data) => {
        adminManager.updateAccessConfig(socket, io, data, getContext());
    }));

    // --- SCORING ACTIONS ---
    socket.on('admin_add_points', adminAction((data) => {
        if (!showConfig.hasPoints) return;
        const {playerName, amount} = data;
        if (!playerName) return;
        if (!state.scores[playerName]) state.scores[playerName] = 0;
        state.scores[playerName] += amount;
        persist();
        io.emit('sync_state', getSyncData());
        refreshAdminLists();
    }));

    socket.on('admin_reset_scores', adminAction(() => {
        state.scores = {};
        persist();
        io.emit('sync_state', getSyncData());
        refreshAdminLists();
    }));

    socket.on('admin_toggle_score_visibility', adminAction((data) => {
        state.isScoreVisible = data.value;
        persist();
        io.emit('sync_state', getSyncData());
        refreshAdminLists();
    }));

    // --- PROPOSALS LOGIC ---
    socket.on('send_proposal', (data) => {
        // If the proposal contains a valid admin token, we mark it as an admin proposal
        if (data && data.token && isValidAdmin(data.token)) {
            data.isAdmin = true;
        }
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
        const shows = await ShowManager.listShows();
        socket.emit('admin_shows_list', shows);
    }));

    socket.on('admin_delete_show', adminAction(async (data) => {
        await ShowManager.deleteShow(data.showId);
        const shows = await ShowManager.listShows();
        socket.emit('admin_shows_list', shows);
    }));

    socket.on('admin_load_show', adminAction((data) => {
        loadShowConfig(data.showId);
        state.activeShowId = data.showId;
        state.currentSceneIndex = 0;
        state.isLive = false;
        state.allProposals = [];
        state.activePreset = null;
        state.activeUsers.forEach(u => { u.proposals = []; });
        persist();
        io.emit('sync_state', getSyncData());
        io.to('admin_room').emit('admin_sync_proposals', []);
        io.emit('user_history_update', []);
    }));

    socket.on('admin_toggle_live', adminAction((data) => {
        state.isLive = data.value;
        if (state.isLive === true) {
            state.currentSceneIndex = 0;
        }
        if (state.isLive === false) {
            state.activeUsers = [];
            state.pendingRequests = [];
            state.scores = {};
            state.allProposals = [];
            state.activePreset = null;
            state.accessConfig.whitelist.forEach(c => {
                c.used = false;
                c.playerName = '';
            });
            io.emit('status_update', {
                status: 'session_expired',
                reason: "Le spectacle est terminé. Merci de votre participation !"
            });
        }
        persist();
        io.emit('sync_state', getSyncData());
        io.to('admin_room').emit('admin_sync_proposals', state.allProposals);
        refreshAdminLists();
    }));

    socket.on('admin_toggle_joins', adminAction((data) => {
        state.allowNewJoins = data.value;
        persist();
        io.to('admin_room').emit('admin_joins_status', state.allowNewJoins);
        refreshAdminLists();
    }));

    socket.on('admin_approve_user', adminAction((data) => adminManager.approveUser(socket, io, data, getContext())));
    socket.on('admin_kick_user', adminAction((data) => adminManager.kickUser(socket, io, data, getContext())));
    socket.on('admin_rename_user', adminAction((data) => adminManager.renameUser(socket, io, data, getContext())));
    socket.on('admin_set_scene', adminAction((data) => {
        state.currentSceneIndex = data.index;
        state.allProposals = [];
        state.activePreset = null;
        state.activeUsers.forEach(u => { u.proposals = []; });
        persist();
        io.emit('sync_state', getSyncData());
        io.to('admin_room').emit('admin_sync_proposals', []);
        io.emit('user_history_update', []);
    }));

    socket.on('admin_clear_all_proposals', adminAction((data) => {
        state.allProposals = [];
        state.activeUsers.forEach(u => {
            u.proposals = [];
        });

        persist();

        io.to('admin_room').emit('admin_sync_proposals', state.allProposals);
        io.emit('user_history_update', []);
        io.emit('sync_state', getSyncData());
    }));

    // --- JOIN & DISCONNECT ---=
    socket.on('join_request', (data) => {
        if (!state.isLive && !data.isReconnect) {
            return socket.emit('status_update', {status: 'rejected', reason: "ERROR_SHOW_NOT_STARTED"});
        }

        // --- RECONNECTION LOGIC ---
        if (data.isReconnect && data.token) {
            const existingUser = state.activeUsers.find(u => u.token === data.token);
            if (existingUser) {
                existingUser.socketId = socket.id;
                existingUser.connected = true;
                persist();
                socket.emit('status_update', {status: 'approved', name: existingUser.name, token: existingUser.token});
                socket.emit('sync_state', getSyncData());
                socket.emit('user_history_update', existingUser.proposals || []);
                refreshAdminLists();
                return;
            } else {
                return socket.emit('status_update', {status: 'session_expired', reason: "ERROR_SESSION_EXPIRED"});
            }
        }

        if (!state.allowNewJoins) {
            return socket.emit('status_update', {status: 'rejected', reason: "ERROR_JOINS_CLOSED"});
        }

        const rawName = data.name ? data.name.trim() : "";
        if (!rawName) return;
        if (rawName.length > 25) {
            return socket.emit('status_update', {
                status: 'rejected',
                reason: "ERROR_NAME_TOO_LONG",
                transData: {max: 25}
            });
        }

        const entryCode = data.entryCode ? data.entryCode.trim().toUpperCase() : "";

        // --- ACCESS MODE: PUBLIC ---
        if (state.accessConfig.mode === 'PUBLIC') {
            if (entryCode !== state.accessConfig.publicCode.toUpperCase()) {
                return socket.emit('status_update', {status: 'rejected', reason: "ERROR_INVALID_CODE"});
            }
        }
        // --- ACCESS MODE: WHITELIST (UPDATED LOGIC) ---
        else if (state.accessConfig.mode === 'WHITELIST') {
            const codeObj = state.accessConfig.whitelist.find(c => c.code === entryCode);

            if (!codeObj) {
                return socket.emit('status_update', { status: 'rejected', reason: "ERROR_INVALID_CODE" });
            }

            if (codeObj.used) {
                // [comment] Find the user associated with this code
                const occupant = state.activeUsers.find(u => u.entryCode === entryCode);

                if (occupant) {
                    if (occupant.connected) {
                        // [comment] If still online, we block the access
                        return socket.emit('status_update', { status: 'rejected', reason: "ERROR_CODE_ALREADY_USED" });
                    } else {
                        // [comment] HE IS DISCONNECTED: We perform a "takeover"
                        // We generate a new token and transfer data (scores, etc.)
                        const userToken = crypto.randomBytes(16).toString('hex');

                        // [comment] Update the occupant's data with new socket and token
                        occupant.socketId = socket.id;
                        occupant.token = userToken;
                        occupant.connected = true;
                        // Note: occupant.name and occupant.score remain unchanged

                        persist();

                        // [comment] Immediate approval (no need to go through pending)
                        socket.emit('status_update', {
                            status: 'approved',
                            name: occupant.name,
                            token: userToken
                        });

                        socket.emit('sync_state', getSyncData());
                        socket.emit('user_history_update', occupant.proposals || []);
                        refreshAdminLists();
                        return;
                    }
                }
            }
        }

        const nameLower = rawName.toLowerCase();
        const isNameTaken = state.activeUsers.some(u => u.name.toLowerCase() === nameLower) ||
            state.pendingRequests.some(r => r.name.toLowerCase() === nameLower);

        if (isNameTaken) {
            return socket.emit('status_update', {status: 'rejected', reason: "ERROR_NAME_TAKEN"});
        }

        // Mark code as used if not already
        if (state.accessConfig.mode === 'WHITELIST') {
            const codeObj = state.accessConfig.whitelist.find(c => c.code === entryCode);
            if (codeObj) {
                codeObj.used = true;
                codeObj.playerName = rawName;
            }
        }

        const userToken = crypto.randomBytes(16).toString('hex');
        const req = {
            socketId: socket.id,
            name: rawName,
            token: userToken,
            connected: true,
            proposals: [],
            entryCode: entryCode,
            score: 0
        };

        state.pendingRequests.push(req);
        persist();
        socket.emit('status_update', {status: 'pending', token: userToken});
        io.to('admin_room').emit('admin_new_request', req);
        refreshAdminLists();
    });

    socket.on('disconnect', () => {
        const user = state.activeUsers.find(u => u.socketId === socket.id);
        if (user) {
            user.connected = false;
            persist();
        }
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