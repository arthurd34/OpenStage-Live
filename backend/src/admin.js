const sceneManager = require('./scenes');

module.exports = {
    // --- ACCESS CONTROL MANAGEMENT ---
    updateAccessConfig: (socket, io, data, context) => {
        const { accessConfig } = data;
        const { setAccessConfig, refreshAdminLists } = context;

        if (accessConfig) {
            // Update global state and trigger persistence
            setAccessConfig(accessConfig);

            // Sync new config to all admins immediately
            refreshAdminLists();
        }
    },

    approveUser: (socket, io, data, context) => {
        const { socketId, welcomeMessage } = data;
        const {
            pendingRequests,
            activeUsers,
            refreshAdminLists,
            getSyncData,
            setActiveUsers,
            setPendingRequests
        } = context;

        const userReq = pendingRequests.find(r => r.socketId === socketId);
        if (userReq) {
            // Remove from pending and add to active
            const newPending = pendingRequests.filter(r => r.socketId !== socketId);
            const newActive = [...activeUsers, { ...userReq, connected: true }];

            // Using setters triggers persist() in server.js
            setPendingRequests(newPending);
            setActiveUsers(newActive);

            io.to(socketId).emit('status_update', {
                status: 'approved',
                message: welcomeMessage
            });
            io.to(socketId).emit('sync_state', getSyncData());
            refreshAdminLists();
        }
    },

    kickUser: (socket, io, data, context) => {
        const { socketId, reason, isRefusal } = data;
        const {
            activeUsers,
            pendingRequests,
            accessConfig,
            refreshAdminLists,
            setActiveUsers,
            setPendingRequests,
            setAccessConfig
        } = context;

        const user = activeUsers.find(u => u.socketId === socketId);

        // If using Whitelist, we might want to release the code when kicking/refusing
        if (accessConfig.mode === 'WHITELIST' && (user || pendingRequests.some(r => r.socketId === socketId))) {
            const targetUser = user || pendingRequests.find(r => r.socketId === socketId);
            const codeObj = accessConfig.whitelist.find(c => c.code === targetUser.entryCode);
            if (codeObj) {
                codeObj.used = false;
                codeObj.playerName = "";
                setAccessConfig(accessConfig);
            }
        }

        if (user) {
            // Scene cleanup (proposals, etc.) through sceneManager
            sceneManager.cleanupUser(io, user, context);
        }

        io.to(socketId).emit('status_update', {
            status: isRefusal ? 'rejected' : 'kicked',
            reason: reason ? "Un administrateur a mis fin à votre session pour la raison suivante : " + reason : "Un administrateur a mis fin à votre session."
        });

        // Filter lists and trigger persistence via setters
        const newActiveList = activeUsers.filter(u => u.socketId !== socketId);
        const newPendingList = pendingRequests.filter(u => u.socketId !== socketId);

        setActiveUsers(newActiveList);
        setPendingRequests(newPendingList);

        refreshAdminLists();

        setTimeout(() => {
            const target = io.sockets.sockets.get(socketId);
            if (target) target.disconnect();
        }, 500);
    },

    renameUser: (socket, io, data, context) => {
        const { socketId, newName } = data;
        const { activeUsers, refreshAdminLists, setActiveUsers } = context;

        const user = activeUsers.find(u => u.socketId === socketId);
        if (user) {
            // Update the name and trigger persistence
            const newActive = activeUsers.map(u =>
                u.socketId === socketId ? { ...u, name: newName } : u
            );

            setActiveUsers(newActive);

            io.to(socketId).emit('name_updated', newName);
            refreshAdminLists();
        }
    }
};