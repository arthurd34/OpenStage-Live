module.exports = {
    send_proposal: (socket, io, data, context) => {
        const { activeUsers, allProposals, currentScene, setAllProposals, setActiveUsers, getSyncData } = context;

        // --- 1. CAS : AJOUT MANUEL PAR L'ADMIN ---
        if (data.isAdmin) {
            const newProposal = {
                id: Date.now().toString(), // Identifiant unique
                userName: data.userName || "ADMIN",
                text: data.text,
                timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
                isAdmin: true,
                isWinner: false,
                isDisplayed: false
            };

            const updatedAll = [newProposal, ...allProposals];
            setAllProposals(updatedAll);

            io.to('admin_room').emit('admin_sync_proposals', updatedAll);
            io.emit('sync_state', getSyncData());
            return;
        }

        // --- 2. CAS : PROPOSITION NORMIALE D'UN JOUEUR ---
        const user = activeUsers.find(u => u.name === data.userName);
        const maxAllowed = currentScene?.params?.maxProposals || 3;

        if (!user || user.proposals.length >= maxAllowed) {
            console.log(`Refused: limit reached for ${data.userName}`);
            return;
        }

        const newProposal = {
            id: Date.now().toString(),
            userName: data.userName,
            text: data.text,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
            isWinner: false,
            isDisplayed: false
        };

        const updatedUserProposals = [...user.proposals, newProposal];
        const updatedAllProposals = [newProposal, ...allProposals]; // Récent en premier pour l'admin

        const updatedUsers = activeUsers.map(u =>
            u.name === data.userName ? { ...u, proposals: updatedUserProposals } : u
        );

        setActiveUsers(updatedUsers);
        setAllProposals(updatedAllProposals);

        io.to('admin_room').emit('admin_sync_proposals', updatedAllProposals);
        socket.emit('user_history_update', updatedUserProposals);
    },

    admin_approve_proposal: (socket, io, data, context) => {
        const { allProposals, setAllProposals, getSyncData } = context;
        const { id, value } = data;

        const updatedProposals = allProposals.map(p => ({
            ...p,
            isWinner: p.id === id ? value : p.isWinner
        }));

        setAllProposals(updatedProposals);

        // Si on le marque comme gagnant, on le projette. Sinon on cache l'écran.
        if (value === true) {
            const winner = updatedProposals.find(p => p.id === id);
            io.emit('show_on_screen', winner);
            io.to('admin_room').emit('admin_preset_active', null); // On désactive les presets
        } else {
            io.emit('show_on_screen', null);
        }

        io.to('admin_room').emit('admin_sync_proposals', updatedProposals);
        io.emit('sync_state', getSyncData());
    },

    admin_display_proposal: (socket, io, data, context) => {
        const { allProposals, setAllProposals, getSyncData } = context;
        const { id, value } = data;

        const updatedProposals = allProposals.map(p => ({
            ...p,
            isDisplayed: p.id === id ? value : p.isDisplayed
        }));

        setAllProposals(updatedProposals);
        io.to('admin_room').emit('admin_sync_proposals', updatedProposals);
        io.emit('sync_state', getSyncData());
    },

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
            io.to('admin_room').emit('admin_preset_active', data.text);
        } else {
            io.emit('show_on_screen', null);
            io.to('admin_room').emit('admin_preset_active', null);
        }
    },

    admin_delete_proposal: (socket, io, data, context) => {
        const { allProposals, setAllProposals, activeUsers, setActiveUsers, getSyncData } = context;
        const targetId = data.id || data; // Sécurité si c'est un objet ou une string brute

        const proposalToDelete = allProposals.find(p => p.id === targetId);
        if (!proposalToDelete) return;

        // Si la proposition était affichée sur l'écran géant, on nettoie l'écran
        if (proposalToDelete.isWinner) {
            io.emit('show_on_screen', null);
        }

        const updatedAll = allProposals.filter(p => p.id !== targetId);

        const updatedUsers = activeUsers.map(u => {
            if (u.name === proposalToDelete.userName) {
                const newHistory = u.proposals.filter(p => p.id !== targetId);
                // On met à jour le téléphone du joueur IMMÉDIATEMENT
                if (u.socketId) {
                    io.to(u.socketId).emit('user_history_update', newHistory);
                }
                return { ...u, proposals: newHistory };
            }
            return u;
        });

        setAllProposals(updatedAll);
        setActiveUsers(updatedUsers);

        io.to('admin_room').emit('admin_sync_proposals', updatedAll);
        io.emit('sync_state', getSyncData());
    },

    admin_clear_all_proposals: (socket, io, data, context) => {
        const { setActiveUsers, setAllProposals, activeUsers, getSyncData } = context;

        // Vide l'historique de chaque utilisateur
        const clearedUsers = activeUsers.map(u => ({ ...u, proposals: [] }));

        setActiveUsers(clearedUsers);
        setAllProposals([]);

        io.emit('show_on_screen', null); // Cache l'écran géant

        io.to('admin_room').emit('admin_sync_proposals', []);
        io.emit('user_history_update', []); // Vide tous les téléphones
        io.emit('sync_state', getSyncData());
    },

    cleanupUser: (io, user, context) => {
        const { allProposals, setAllProposals } = context;
        const filtered = allProposals.filter(a => a.userName !== user.name);
        setAllProposals(filtered);
        io.to('admin_room').emit('admin_sync_proposals', filtered);
    }
};