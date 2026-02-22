require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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

// --- VERSION CONFIGURATION ---
const VERSION = "1.0.0-beta";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONFIGURATION CORS ---
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "x-admin-token"]
}));

app.use(fileUpload());

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
    // New access configuration
    accessConfig: {
        mode: 'PUBLIC', // 'PUBLIC' or 'WHITELIST'
        publicCode: '1234',
        whitelist: [] // { code: 'ABC', used: false, playerName: '' }
    },
    // New: Global scoring state
    scores: {}, // { "playerName": scoreValue }
    isScoreVisible: false // New: Control scoreboard visibility for players
};

if (!state.adminTokens) state.adminTokens = [];
// Ensure structure exists for older saved states
if (!state.accessConfig) {
    state.accessConfig = { mode: 'PUBLIC', publicCode: '1234', whitelist: [] };
}
// Ensure scores object exists
if (!state.scores) state.scores = {};
// Ensure visibility property exists for saved states
if (state.isScoreVisible === undefined) state.isScoreVisible = false;

let showConfig = {
    name: "No show loaded",
    lang: "fr",
    hasPoints: false, // Default: no points unless specified in show JSON
    scenes: [{ id: 'OFFLINE', title: "Offline", type: "WAITING", params: {} }]
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
 * Includes version and active pack info.
 */
const getSyncData = () => {
    const baseData = {
        isLive: state.isLive,
        activeShowId: state.activeShowId,
        version: VERSION, // <--- Sent to all clients (Public & Admin)
        ui: translations[showConfig.lang] || translations['fr'],
        // Public only needs to know the mode and the allow status
        allowNewJoins: state.allowNewJoins,
        accessMode: state.accessConfig.mode,
        showName: showConfig.name || '',
        // Scoring info based on current show config
        hasPoints: showConfig.hasPoints || false,
        scores: state.scores,
        isScoreVisible: state.isScoreVisible // Send visibility status to all clients
    };

    if (!state.isLive) {
        return {
            ...baseData,
            accessConfig: state.accessConfig, // Admins need this even if not live
            currentScene: { id: 'OFFLINE', type: 'WAITING', params: { titleDisplay: "SHOW_NOT_STARTED" } }
        };
    }

    return {
        ...baseData,
        currentScene: showConfig.scenes[state.currentSceneIndex],
        currentIndex: state.currentSceneIndex,
        playlist: showConfig.scenes,
        accessConfig: state.accessConfig // Full config for admin sync
    };
};

const isValidAdmin = (token) => state.adminTokens && state.adminTokens.includes(token);

const refreshAdminLists = () => {
    io.to('admin_room').emit('admin_user_list', state.activeUsers);
    io.to('admin_room').emit('admin_pending_list', state.pendingRequests);
    // Sync full state to admin to refresh access control UI
    io.to('admin_room').emit('sync_state', getSyncData());
};

const getContext = () => ({
    currentScene: showConfig.scenes[state.currentSceneIndex],
    version: VERSION, // <--- Also available in the global context
    ...state,
    refreshAdminLists,
    getSyncData,
    setAllProposals: (val) => { state.allProposals = val; persist(); },
    setActiveUsers: (val) => { state.activeUsers = val; persist(); },
    setPendingRequests: (val) => { state.pendingRequests = val; persist(); },
    setAccessConfig: (val) => { state.accessConfig = val; persist(); }
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

            socket.join('admin_room');
            socket.emit('login_success', { token: newToken });
            socket.emit('sync_state', getSyncData());
            refreshAdminLists();
            socket.emit('admin_sync_proposals', state.allProposals);
            socket.emit('admin_joins_status', state.allowNewJoins);
            socket.emit('admin_live_status', state.isLive);
            return;
        }

        if (token && isValidAdmin(token)) {
            socket.join('admin_room');
            socket.emit('login_success', { token });
            socket.emit('sync_state', getSyncData());
            refreshAdminLists();
            socket.emit('admin_sync_proposals', state.allProposals);
            socket.emit('admin_joins_status', state.allowNewJoins);
            socket.emit('admin_live_status', state.isLive);
            return;
        }
        socket.emit('login_error', 'ERROR_INVALID_CREDENTIALS');
    });

    // ACCESS CONTROL CONFIGURATION
    socket.on('admin_update_access_config', adminAction((data) => {
        adminManager.updateAccessConfig(socket, io, data, getContext());
    }));

    // --- SCORING ACTIONS ---
    /**
     * Allows admin to add/subtract points from a specific player.
     * Only works if current show hasPoints: true.
     */
    socket.on('admin_add_points', adminAction((data) => {
        if (!showConfig.hasPoints) return;

        const { playerName, amount } = data;
        if (!playerName) return;

        if (!state.scores[playerName]) state.scores[playerName] = 0;
        state.scores[playerName] += amount;

        persist();
        // Sync new scores to everyone
        io.emit('sync_state', getSyncData());
        refreshAdminLists();
    }));

    /**
     * Reset all scores to zero.
     */
    socket.on('admin_reset_scores', adminAction(() => {
        state.scores = {};
        persist();
        io.emit('sync_state', getSyncData());
        refreshAdminLists();
    }));

    /**
     * Toggle visibility of the leaderboard for players.
     */
    socket.on('admin_toggle_score_visibility', adminAction((data) => {
        state.isScoreVisible = data.value;
        persist();
        // Sync visibility status to everyone
        io.emit('sync_state', getSyncData());
        refreshAdminLists();
    }));

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
        // Optionally reset scores on show load
        // state.scores = {};
        persist();
        io.emit('sync_state', getSyncData());
    }));

    socket.on('admin_toggle_live', adminAction((data) => {
        state.isLive = data.value;
        persist();
        io.emit('sync_state', getSyncData());
    }));

    socket.on('admin_toggle_joins', adminAction((data) => {
        state.allowNewJoins = data.value;
        persist();
        io.to('admin_room').emit('admin_joins_status', state.allowNewJoins);
        refreshAdminLists(); // Ensure admin UI reflects the change
    }));

    socket.on('admin_approve_user', adminAction((data) => adminManager.approveUser(socket, io, data, getContext())));
    socket.on('admin_kick_user', adminAction((data) => adminManager.kickUser(socket, io, data, getContext())));
    socket.on('admin_rename_user', adminAction((data) => adminManager.renameUser(socket, io, data, getContext())));
    socket.on('admin_set_scene', adminAction((data) => {
        state.currentSceneIndex = data.index;
        persist();
        io.emit('sync_state', getSyncData());
    }));

    const sceneEvents = ['send_proposal', 'admin_approve_proposal', 'admin_delete_proposal', 'admin_clear_all_proposals'];
    sceneEvents.forEach(event => {
        socket.on(event, (data) => sceneManager.handleEvent(socket, io, event, data, getContext()));
    });

    socket.on('join_request', (data) => {
        // 1. Basic check: is the show live?
        if (!state.isLive && !data.isReconnect) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_SHOW_NOT_STARTED" });
        }

        // 2. Handle Reconnection
        if (data.isReconnect && data.token) {
            const existingUser = state.activeUsers.find(u => u.token === data.token);
            if (existingUser) {
                existingUser.socketId = socket.id;
                existingUser.connected = true;
                persist();
                socket.emit('status_update', { status: 'approved', name: existingUser.name, token: existingUser.token });
                socket.emit('sync_state', getSyncData());
                socket.emit('user_history_update', existingUser.proposals || []);
                refreshAdminLists();
                return;
            } else {
                return socket.emit('status_update', { status: 'session_expired', reason: "ERROR_SESSION_EXPIRED" });
            }
        }

        // 3. New Joins validation
        if (!state.allowNewJoins) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_JOINS_CLOSED" });
        }

        // --- NAME VALIDATION (25 CHARS MAX) ---
        const rawName = data.name ? data.name.trim() : "";
        if (!rawName) return;

        if (rawName.length > 25) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_NAME_TOO_LONG", transData: { max: 25 } });
        }

        // --- ACCESS CODE VALIDATION ---
        const entryCode = data.entryCode ? data.entryCode.trim().toUpperCase() : "";

        if (state.accessConfig.mode === 'PUBLIC') {
            if (entryCode !== state.accessConfig.publicCode.toUpperCase()) {
                return socket.emit('status_update', { status: 'rejected', reason: "ERROR_INVALID_CODE" });
            }
        } else if (state.accessConfig.mode === 'WHITELIST') {
            const codeObj = state.accessConfig.whitelist.find(c => c.code === entryCode);
            if (!codeObj) {
                return socket.emit('status_update', { status: 'rejected', reason: "ERROR_INVALID_CODE" });
            }
            if (codeObj.used) {
                return socket.emit('status_update', { status: 'rejected', reason: "ERROR_CODE_ALREADY_USED" });
            }

            // We will mark the code as used ONLY if the name is also valid
        }

        // --- DUPLICATE NAME CHECK ---
        const nameLower = rawName.toLowerCase();
        const isNameTaken = state.activeUsers.some(u => u.name.toLowerCase() === nameLower) ||
            state.pendingRequests.some(r => r.name.toLowerCase() === nameLower);

        if (isNameTaken) {
            return socket.emit('status_update', { status: 'rejected', reason: "ERROR_NAME_TAKEN" });
        }

        // --- SUCCESS: COMMIT JOIN ---

        // If we are in Whitelist mode, officially mark the code as consumed
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

// --- START SERVER WITH VERSION LOG ---
server.listen(process.env.PORT || 3000, () => {
    console.log(`
=============================================
   OPEN IMPRO LIVE - Version ${VERSION}
=============================================
   Server Ready on port ${process.env.PORT || 3000}
   Mode: ${process.env.NODE_ENV || 'development'}
=============================================
    `);
});