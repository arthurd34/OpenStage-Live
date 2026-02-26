module.exports = {
    send_proposal: (socket, io, data, context) => {
        const { activeUsers, allProposals, currentScene, setAllProposals, setActiveUsers } = context;
        const user = activeUsers.find(u => u.name === data.userName);
        const maxAllowed = currentScene?.params?.maxProposals || 3;

        if (!user || user.proposals.length >= maxAllowed) {
            console.log(`Refused: limit reached for ${data.userName}`);
            return;
        }

        const newProposal = {
            id: Date.now(),
            userName: data.userName,
            text: data.text,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
            isWinner: false
        };

        const updatedUserProposals = [...user.proposals, newProposal];
        const updatedAllProposals = [newProposal, ...allProposals]; // Newest first for admin

        const updatedUsers = activeUsers.map(u =>
            u.name === data.userName ? { ...u, proposals: updatedUserProposals } : u
        );

        setActiveUsers(updatedUsers);
        setAllProposals(updatedAllProposals);

        io.to('admin_room').emit('admin_sync_proposals', updatedAllProposals);
        socket.emit('user_history_update', updatedUserProposals);
    },

    admin_approve_proposal: (socket, io, ans, context) => {
        const { allProposals, activeUsers, setAllProposals, setActiveUsers } = context;

        const updatedAll = allProposals.map(a =>
            a.id === ans.id ? { ...a, isWinner: true } : a
        );

        const updatedUsers = activeUsers.map(u => {
            if (u.name === ans.userName) {
                return {
                    ...u,
                    proposals: u.proposals.map(p => p.id === ans.id ? { ...p, isWinner: true } : p)
                };
            }
            return u;
        });

        setAllProposals(updatedAll);
        setActiveUsers(updatedUsers);

        const winner = updatedAll.find(a => a.id === ans.id);
        io.emit('show_on_screen', winner || ans);
        io.to('admin_room').emit('admin_sync_proposals', updatedAll);

        const targetUser = updatedUsers.find(u => u.name === ans.userName);
        if (targetUser) {
            io.to(targetUser.socketId).emit('user_history_update', targetUser.proposals);
        }
    },

    // --- NEW: VIRTUAL PROPOSAL FOR PRESETS ---
    admin_set_proposal_winner: (socket, io, data, context) => {
        if (data.action === 'SHOW') {
            const virtualWinner = {
                id: 'preset-active',
                userName: "",
                text: data.text,
                timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
                isWinner: true,
                isAdmin: true
            };
            io.emit('show_on_screen', virtualWinner);
        } else {
            io.emit('show_on_screen', null);
        }
    },

    // --- NEW: DELETE SINGLE PROPOSAL ---
    admin_delete_proposal: (socket, io, proposalId, context) => {
        const { allProposals, setAllProposals, activeUsers, setActiveUsers } = context
        // Find the proposal to delete and its author
        const proposalToDelete = allProposals.find(p => p.id === proposalId);
        if (!proposalToDelete) return;

        const updatedAll = allProposals.filter(p => p.id !== proposalId);

        // update the user's proposal list and notify them
        const updatedUsers = activeUsers.map(u => {
            if (u.name === proposalToDelete.userName) {
                const newHistory = u.proposals.filter(p => p.id !== proposalId);
                // Notify the user about the updated history after deletion
                io.to(u.socketId).emit('user_history_update', newHistory);
                return { ...u, proposals: newHistory };
            }
            return u;
        });

        setAllProposals(updatedAll);
        setActiveUsers(updatedUsers);

        io.to('admin_room').emit('admin_sync_proposals', updatedAll);
    },

    // --- NEW: CLEAR EVERYTHING ---
    admin_clear_all_proposals: (socket, io, data, context) => {
        const { setActiveUsers, setAllProposals, activeUsers } = context;

        const clearedUsers = activeUsers.map(u => ({ ...u, proposals: [] }));

        setActiveUsers(clearedUsers);
        setAllProposals([]);

        io.to('admin_room').emit('admin_sync_proposals', []);
        io.emit('user_history_update', []); // Clear all clients' history
    },

    cleanupUser: (io, user, context) => {
        const { allProposals, setAllProposals } = context;
        const filtered = allProposals.filter(a => a.userName !== user.name);
        setAllProposals(filtered);
        io.to('admin_room').emit('admin_sync_proposals', filtered);
    }
};