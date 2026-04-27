// ============================================
// SYNCHRONISATION GOOGLE DRIVE (Drive du client)
// ============================================
// CE FICHIER REMPLACE COMPLÈTEMENT L'ANCIEN sync.js
// ============================================

class GoogleDriveSync {
    constructor(db) {
        this.db = db;
        this.accessToken = localStorage.getItem('gd_accessToken') || null;
        this.refreshToken = localStorage.getItem('gd_refreshToken') || null;
        this.tokenExpiry = localStorage.getItem('gd_tokenExpiry') || null;
        this.isOnline = navigator.onLine;
        this.isAuthenticated = !!this.accessToken;
        
        // CONFIGURATION - REMPLACE PAR TES IDENTIFIANTS
        this.CLIENT_ID = '735608729806-b3kuqdm0jthoblsodh8s0vfuialo9mda.apps.googleusercontent.com'; // ← À remplacer
        
        this.SCOPES = 'https://www.googleapis.com/auth/drive.appfolder';
        
        this.init();
        console.log('GoogleDriveSync initialisé');
    }
    
    init() {
        // Charger l'API Google
        this.loadGoogleAPI();
        
        // Écouteurs de connexion
        window.addEventListener('online', () => {
            this.isOnline = true;
            if (this.isAuthenticated) this.checkAndSync();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }
    
    loadGoogleAPI() {
        if (document.querySelector('script[src*="accounts.google.com"]')) {
            // Déjà chargé
            if (window.google) this.initTokenClient();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => this.initTokenClient();
        document.head.appendChild(script);
    }
    
    initTokenClient() {
        if (!window.google) return;
        
        try {
            this.client = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('Erreur auth:', response.error);
                        return;
                    }
                    
                    this.accessToken = response.access_token;
                    
                    // Calculer la date d'expiration (jeton valide 1 heure = 3600 secondes)
                    const expiresIn = response.expires_in || 3600;
                    this.tokenExpiry = Date.now() + (expiresIn * 1000);
                    
                    localStorage.setItem('gd_accessToken', this.accessToken);
                    localStorage.setItem('gd_tokenExpiry', this.tokenExpiry);
                    
                    this.isAuthenticated = true;
                    
                    this.updateUI();
                    this.syncToDrive();
                },
            });
            console.log('Client OAuth initialisé');
        } catch (error) {
            console.error('Erreur init OAuth:', error);
        }
    }

    async validateTokenBeforeOperation() {
        if (!this.isAuthenticated) {
            return false;
        }
        
        // Tester le jeton avec une petite requête
        try {
            const response = await fetch(
                'https://www.googleapis.com/drive/v3/about?fields=user',
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (response.ok) {
                return true;
            } else if (response.status === 401) {
                return await this.refreshAccessToken();
            } else {
                return false;
            }
        } catch (error) {
            console.error('Erreur validation jeton:', error);
            return false;
        }
    }

    async signIn() {
        return new Promise((resolve, reject) => {
            try {
                if (!this.client) {
                    this.initTokenClient();
                    setTimeout(() => {
                        if (this.client) {
                            this.client.requestAccessToken();
                            resolve();
                        } else {
                            reject(new Error('Client non initialisé'));
                        }
                    }, 1000);
                } else {
                    this.client.requestAccessToken();
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }
    
    signOut() {
        if (this.accessToken && window.google) {
            google.accounts.oauth2.revoke(this.accessToken, () => {
                console.log('Accès révoqué');
            });
        }
        
        localStorage.removeItem('gd_accessToken');
        localStorage.removeItem('gd_refreshToken');
        localStorage.removeItem('gd_tokenExpiry');
        
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.isAuthenticated = false;
        
        this.updateUI();
        this.showNotification('Déconnecté de Google Drive');
    }
    
    isTokenValid() {
        return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }
    
    async checkAndSync() {
        if (!this.isOnline || !this.isAuthenticated) return;
        await this.syncToDrive();
    }
    
    // Dans GoogleDriveSync.syncToDrive()
    async syncToDrive() {
        if (!this.isAuthenticated || !this.isOnline) {
            console.log('Non authentifié ou hors ligne');
            return;
        }
        
        try {
            // Récupérer les dépenses non synchronisées
            const unsyncedExpenses = await this.db.getUnsyncedExpenses();
            
            if (unsyncedExpenses.length === 0) {
                console.log('Aucune dépense à synchroniser');
                if (window.app) window.app.showNotification('Tout est déjà synchronisé', 'info');
                return;
            }
            
            console.log(`${unsyncedExpenses.length} dépenses à synchroniser`);
            
            // Préparer les données
            const data = {
                version: '1.0',
                lastSync: new Date().toISOString(),
                expenses: unsyncedExpenses
            };
            
            // Chercher le fichier dans le Drive
            const fileId = await this.findUserFile();
            
            if (fileId) {
                await this.updateUserFile(fileId, data);
            } else {
                await this.createUserFile(data);
            }
            
            // MARQUER COMME SYNCHRONISÉES (avec string "1")
            for (const expense of unsyncedExpenses) {
                await this.db.markAsSynced(expense.id);
            }
            
            console.log('✅ Synchronisation réussie');
            if (window.app) window.app.showNotification(`${unsyncedExpenses.length} dépenses synchronisées`, 'success');
            
        } catch (error) {
            console.error('❌ Erreur synchronisation:', error);
            if (window.app) window.app.showNotification('Échec synchronisation', 'error');
        }
    }
    
    async findUserFile() {
        try {
            // Vérifier et rafraîchir le jeton si nécessaire AVANT la requête
            if (!await this.ensureValidToken()) {
                console.log('Impossible de rafraîchir le jeton');
                return null;
            }

            const response = await fetch(
                'https://www.googleapis.com/drive/v3/files?q=name%3D%22gestion-depenses.json%22%20and%20%27appDataFolder%27%20in%20parents&spaces=appDataFolder&fields=files(id,name,modifiedTime)',
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            // Si la réponse est 401, le jeton est peut-être déjà expiré entre la vérification et l'envoi
            if (response.status === 401) {
                console.log('Jeton expiré, tentative de rafraîchissement...');
                // Forcer un rafraîchissement
                if (await this.refreshAccessToken()) {
                    // Réessayer la requête avec le nouveau jeton
                    return this.findUserFile();
                } else {
                    return null;
                }
            }
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data.files && data.files.length > 0 ? data.files[0] : null;
        } catch (error) {
            console.error('Erreur recherche fichier:', error);
            return null;
        }
    }

    // Vérifier si le token est valide et le rafraîchir si nécessaire
    async ensureValidToken() {
        // Vérifier si le token existe
        if (!this.accessToken) {
            console.log('Aucun token disponible');
            return false;
        }
        
        // Vérifier l'expiration (si on a une date d'expiration)
        if (this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return true; // Token encore valide
        }
        
        // Token expiré ou pas de date d'expiration, essayer de rafraîchir
        return await this.refreshAccessToken();
    }

    // Rafraîchir le jeton d'accès
async refreshAccessToken() {
    console.log('Tentative de rafraîchissement du jeton...');
    
    // IMPORTANT: Google n'utilise pas de refresh token dans les applications JS pures
    // Pour les applications côté client, on ne peut pas rafraîchir automatiquement
    // Il faut rediriger l'utilisateur pour une nouvelle authentification
    
    if (window.app) {
        window.app.showNotification('Session expirée, veuillez vous reconnecter', 'warning');
    }
    
    // Déconnecter l'utilisateur
    this.signOut();
    
    // Ouvrir le panneau Drive pour qu'il se reconnecte
    this.openDrivePanel();
    
    return false;
}
    
    async updateUserFile(fileId, data) {
        if (!await this.ensureValidToken()) return false;
        
        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }
        );
        
        if (response.status === 401) {
            if (await this.refreshAccessToken()) {
                return this.updateUserFile(fileId, data);
            }
            return false;
        }
        
        return response.ok;
    }

    async createUserFile(data) {
        if (!await this.ensureValidToken()) return false;
        
        const metadata = {
            name: 'gestion-depenses.json',
            parents: ['appDataFolder']
        };
        
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            },
            body: formData
        });
        
        if (response.status === 401) {
            if (await this.refreshAccessToken()) {
                return this.createUserFile(data);
            }
            return false;
        }
        
        return response.ok;
    }

    async restoreFromDrive() {
        if (!this.isAuthenticated || !this.isOnline) return;
        
        try {
            const fileId = await this.findUserFile();
            if (!fileId) return;
            
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.expenses && data.expenses.length > 0) {
                console.log('Données trouvées sur votre Drive:', data.expenses.length, 'dépenses');
                this.showNotification('📥 Données chargées depuis votre Drive');
            }
            
        } catch (error) {
            console.error('Erreur restauration:', error);
        }
    }
    
    // Importer les données depuis Google Drive
    async importFromDrive() {
        if (!this.isAuthenticated) {
            if (window.app) {
                window.app.showNotification('Veuillez d\'abord vous connecter à Google Drive', 'warning');
            }
            // Ouvrir le panneau Drive
            const panel = document.getElementById('drivePanel');
            if (panel) panel.classList.add('active');
            return;
        }
        
        if (!this.isOnline) {
            if (window.app) window.app.showNotification('Vous êtes hors ligne', 'error');
            return;
        }
        
        if (window.app) window.app.showNotification('Recherche de sauvegardes...', 'info');
        
        try {
            // Chercher le fichier dans le Drive
            const fileId = await this.findUserFile();
            
            if (!fileId) {
                if (window.app) window.app.showNotification('Aucune sauvegarde trouvée sur votre Drive', 'warning');
                return;
            }
            
            // Télécharger le fichier
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Erreur téléchargement');
            }
            
            const remoteData = await response.json();
            
            if (!remoteData.expenses || !Array.isArray(remoteData.expenses)) {
                throw new Error('Format de fichier invalide');
            }
            
            // Récupérer les dépenses locales
            const localExpenses = await this.db.getAllExpenses();
            
            // Compter les nouvelles dépenses
            const localIds = new Set(localExpenses.map(e => e.localId));
            const newExpenses = remoteData.expenses.filter(e => !localIds.has(e.localId));
            
            if (newExpenses.length === 0) {
                if (window.app) window.app.showNotification('Toutes les données sont déjà à jour', 'success');
                return;
            }
            
            // Demander confirmation
            const confirmMessage = `${newExpenses.length} nouvelle(s) dépense(s) trouvée(s) sur Drive. Voulez-vous les importer ?`;
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            if (window.app) window.app.showNotification(`Import de ${newExpenses.length} dépenses...`, 'info');
            
            // Importer les nouvelles dépenses
            let importedCount = 0;
            for (const expense of newExpenses) {
                try {
                    // S'assurer que synced est "1" pour les données importées
                    const expenseToAdd = {
                        ...expense,
                        synced: "1", // Marquer comme déjà synchronisé
                        id: undefined // Laisser la DB générer un nouvel ID
                    };
                    
                    await this.db.addExpense(expenseToAdd);
                    importedCount++;
                } catch (error) {
                    console.error('Erreur import dépense:', error);
                }
            }
            
            if (window.app) {
                window.app.showNotification(`${importedCount} dépenses importées avec succès !`, 'success');
                window.app.loadExpenses(); // Recharger l'affichage
            }
            
        } catch (error) {
            console.error('Erreur import:', error);
            if (window.app) window.app.showNotification('Erreur lors de l\'importation', 'error');
        }
    }

    // Importer avec fusion intelligente (évite les doublons)
    async importWithMerge() {
        if (!this.isAuthenticated) {
            if (window.app) window.app.showNotification('Connectez-vous d\'abord', 'warning');
            return;
        }
        
        try {
            const fileId = await this.findUserFile();
            if (!fileId) {
                if (window.app) window.app.showNotification('Aucune sauvegarde trouvée', 'warning');
                return;
            }
            
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            const remoteData = await response.json();
            const localExpenses = await this.db.getAllExpenses();
            
            // Créer des maps pour la comparaison
            const localByLocalId = new Map();
            const localByDate = new Map();
            
            localExpenses.forEach(exp => {
                if (exp.localId) localByLocalId.set(exp.localId, exp);
                // Utiliser la date comme fallback
                const dateKey = exp.date + '-' + exp.amount + '-' + exp.name;
                localByDate.set(dateKey, exp);
            });
            
            let newCount = 0;
            let updatedCount = 0;
            
            for (const remoteExp of remoteData.expenses) {
                // Vérifier par localId
                if (remoteExp.localId && localByLocalId.has(remoteExp.localId)) {
                    // Mise à jour possible si la version distante est plus récente
                    const localExp = localByLocalId.get(remoteExp.localId);
                    const remoteDate = new Date(remoteExp.updatedAt || remoteExp.createdAt || 0);
                    const localDate = new Date(localExp.updatedAt || localExp.createdAt || 0);
                    
                    if (remoteDate > localDate) {
                        await this.db.updateExpense(localExp.id, remoteExp);
                        updatedCount++;
                    }
                    continue;
                }
                
                // Vérifier par date+montant+nom (pour éviter les doublons)
                const dateKey = remoteExp.date + '-' + remoteExp.amount + '-' + remoteExp.name;
                if (localByDate.has(dateKey)) {
                    // Déjà existant avec les mêmes caractéristiques
                    continue;
                }
                
                // Nouvelle dépense
                await this.db.addExpense({
                    ...remoteExp,
                    synced: "1",
                    id: undefined
                });
                newCount++;
            }
            
            if (window.app) {
                window.app.showNotification(
                    `Import terminé: ${newCount} nouvelle(s), ${updatedCount} mise(s) à jour`,
                    'success'
                );
                window.app.loadExpenses();
            }
            
        } catch (error) {
            console.error('Erreur fusion:', error);
            if (window.app) window.app.showNotification('Erreur lors de la fusion', 'error');
        }
    }

    // Ouvrir le panneau Drive
    openDrivePanel() {
        const panel = document.getElementById('drivePanel');
        if (panel) {
            panel.classList.add('active');
        }
    }



    updateUI() {
        const statusEl = document.querySelector('.drive-status');
        const signInBtn = document.getElementById('driveSignInBtn');
        const signOutBtn = document.getElementById('driveSignOutBtn');
        const syncBtn = document.getElementById('driveSyncBtn');
        
        if (statusEl) {
            if (this.isAuthenticated) {
                statusEl.innerHTML = `
                    <span class="material-icons" style="color:#34a853;">check_circle</span>
                    <span>Connecté à votre Drive</span>
                `;
            } else {
                statusEl.innerHTML = `
                    <span class="material-icons">cloud_off</span>
                    <span>Non connecté</span>
                `;
            }
        }
        
        if (signInBtn) signInBtn.style.display = this.isAuthenticated ? 'none' : 'block';
        if (signOutBtn) signOutBtn.style.display = this.isAuthenticated ? 'block' : 'none';
        if (syncBtn) syncBtn.disabled = !this.isAuthenticated;
    }
    
    showNotification(message, type = 'success') {
        if (window.app && window.app.showNotification) {
            window.app.showNotification(message, type);
        } else {
            console.log('Notification:', message);
        }
    }
}

// ============================================
// AJOUT DU BOUTON DRIVE DANS L'INTERFACE
// ============================================

function addGoogleDriveButton() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    
    // Vérifier si le bouton existe déjà
    if (document.getElementById('googleDriveBtn')) return;
    
    const driveBtn = document.createElement('button');
    driveBtn.className = 'btn-icon google-drive-btn';
    driveBtn.id = 'googleDriveBtn';
    driveBtn.innerHTML = `
        <span class="material-icons">cloud</span>
    `;
    driveBtn.title = 'Google Drive';
    
    // Insérer au début
    headerActions.insertBefore(driveBtn, headerActions.firstChild);
    
    addDrivePanel();
}

function addDrivePanel() {
    // Vérifier si le panel existe déjà
    if (document.getElementById('drivePanel')) return;
    
    const panel = document.createElement('div');
    panel.className = 'drive-panel';
    panel.id = 'drivePanel';
    panel.innerHTML = `
        <div class="drive-header">
            <h3>
                <span class="material-icons">cloud</span>
                Google Drive
            </h3>
            <span class="material-icons close-panel">close</span>
        </div>
        <div class="drive-content">
            <div class="drive-status" id="driveStatus">
                <span class="material-icons">cloud_off</span>
                <span>Non connecté</span>
            </div>
            
            <div class="drive-info">
                <p>🔐 <strong>Votre espace personnel</strong></p>
                <p>Les données sont sauvegardées dans <strong>votre</strong> Google Drive.</p>
            </div>
            
            <button id="driveSignInBtn" class="btn-add" style="width:100%; margin:10px 0;">
                <span class="material-icons">login</span>
                Se connecter à mon Drive
            </button>
            
            <button id="driveSignOutBtn" class="btn-add" style="width:100%; margin:10px 0; display:none;">
                <span class="material-icons">logout</span>
                Déconnexion
            </button>
            
            <button id="driveSyncBtn" class="btn-add" style="width:100%; margin:10px 0; background:#34a853;" disabled>
                <span class="material-icons">sync</span>
                Sauvegarder sur mon Drive
            </button>
            
            <div class="drive-last-sync" id="lastSyncInfo">
                Dernière synchro : Jamais
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Gestionnaires d'événements
    const driveBtn = document.getElementById('googleDriveBtn');
    const closeBtn = panel.querySelector('.close-panel');
    const signInBtn = document.getElementById('driveSignInBtn');
    const signOutBtn = document.getElementById('driveSignOutBtn');
    const syncBtn = document.getElementById('driveSyncBtn');
    
    if (driveBtn) {
        driveBtn.addEventListener('click', () => {
            panel.classList.toggle('active');
            if (window.driveSync) window.driveSync.updateUI();
        });
    }
    
    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
    });
    
    signInBtn.addEventListener('click', async () => {
        if (window.driveSync) {
            await window.driveSync.signIn();
        }
    });
    
    signOutBtn.addEventListener('click', () => {
        if (window.driveSync) {
            window.driveSync.signOut();
        }
    });
    
    syncBtn.addEventListener('click', async () => {
        if (window.driveSync) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<span class="material-icons rotating">sync</span> Sauvegarde...';
            
            await window.driveSync.syncToDrive();
            
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<span class="material-icons">sync</span> Sauvegarder sur mon Drive';
            
            const lastSync = new Date().toLocaleString();
            document.getElementById('lastSyncInfo').textContent = `Dernière synchro : ${lastSync}`;
        }
    });
    
    // Fermer en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (panel && driveBtn && !panel.contains(e.target) && !driveBtn.contains(e.target)) {
            panel.classList.remove('active');
        }
    });
    
    // Ajouter les styles
    addDriveStyles();
}

function addDriveStyles() {
    if (document.getElementById('driveStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'driveStyles';
    style.textContent = `
        .google-drive-btn {
            color: #34a853 !important;
        }
        
        .drive-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 350px;
            max-width: calc(100% - 40px);
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 1000;
            display: none;
            animation: slideDown 0.3s ease;
        }
        
        .drive-panel.active {
            display: block;
        }
        
        .drive-header {
            padding: 16px 20px;
            border-bottom: 2px solid #edf2f4;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .drive-header h3 {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #2b2d42;
        }
        
        .drive-header .material-icons {
            color: #34a853;
        }
        
        .drive-content {
            padding: 20px;
        }
        
        .drive-status {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 15px;
        }
        
        .drive-info {
            margin-top: 10px;
            padding: 12px;
            background: #e8f5e9;
            border-radius: 8px;
            font-size: 13px;
            color: #2b2d42;
        }
        
        .drive-last-sync {
            margin-top: 15px;
            text-align: center;
            font-size: 12px;
            color: #8d99ae;
        }
        
        .rotating {
            animation: rotate 1s linear infinite;
        }
        
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    
    document.head.appendChild(style);
}

// Ajouter un bouton d'importation dans le panneau Drive
function addImportButtonToDrivePanel() {
    const drivePanel = document.getElementById('drivePanel');
    if (!drivePanel) return;
    
    const driveContent = drivePanel.querySelector('.drive-content');
    if (!driveContent) return;
    
    // Vérifier si le bouton existe déjà
    if (document.getElementById('driveImportBtn')) return;
    
    const importBtn = document.createElement('button');
    importBtn.id = 'driveImportBtn';
    importBtn.className = 'btn-add';
    importBtn.style.cssText = 'width:100%; margin:10px 0; background:#4cc9f0;';
    importBtn.innerHTML = `
        <span class="material-icons">cloud_download</span>
        <span data-i18n="importFromDrive">Importer depuis Drive</span>
    `;
    
    // Insérer avant le bouton de synchronisation
    const syncBtn = document.getElementById('driveSyncBtn');
    if (syncBtn) {
        syncBtn.parentNode.insertBefore(importBtn, syncBtn);
    } else {
        driveContent.appendChild(importBtn);
    }
    
    importBtn.addEventListener('click', async () => {
        if (window.driveSync) {
            await window.driveSync.importFromDrive();
        }
    });
}

// Appeler cette fonction après l'initialisation
if (typeof addImportButtonToDrivePanel === 'function') {
    setTimeout(addImportButtonToDrivePanel, 1000);
}

// ============================================
// EXPORT POUR APP.JS
// ============================================

// Rendre disponible globalement
window.GoogleDriveSync = GoogleDriveSync;
window.addGoogleDriveButton = addGoogleDriveButton;