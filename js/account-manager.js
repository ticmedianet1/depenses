// ============================================
// GESTIONNAIRE DE COMPTES (INTERFACE UTILISATEUR)
// ============================================

class AccountManager {
    constructor(db) {
        this.db = db;
        this.accounts = [];
        this.currentAccount = null;
        this.init();
    }

    async init() {
        await this.loadAccounts();
        this.renderAccountSelector();
    }

    async loadAccounts() {
        this.accounts = await this.db.getAllAccounts();
        if (this.accounts.length === 0) {
            console.log('Aucun compte trouvé');
        }
    }

    renderAccountSelector() {
        if (document.getElementById('accountSelector')) return;

        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) {
            console.log('Header actions non trouvé');
            return;
        }

        const selector = document.createElement('div');
        selector.className = 'account-selector';
        selector.id = 'accountSelector';
        selector.innerHTML = `
            <button class="account-btn" id="accountBtn">
                <span class="material-icons">account_balance_wallet</span>
                <span id="currentAccountName">${this.accounts[0]?.name || 'Compte'}</span>
                <span class="material-icons">arrow_drop_down</span>
            </button>
            <div class="account-dropdown" id="accountDropdown">
                <div class="account-list" id="accountList"></div>
                <button class="add-account-btn" id="addAccountBtn">
                    <span class="material-icons">add</span>
                    Nouveau compte
                </button>
            </div>
        `;

        headerActions.insertBefore(selector, headerActions.firstChild);
        this.attachAccountEvents();
        this.renderAccountList();
    }

    attachAccountEvents() {
        const accountBtn = document.getElementById('accountBtn');
        const dropdown = document.getElementById('accountDropdown');
        const addBtn = document.getElementById('addAccountBtn');

        accountBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        addBtn.addEventListener('click', () => {
            this.showCreateAccountDialog();
            dropdown.classList.remove('active');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });
    }

    renderAccountSelector() {
        if (document.getElementById('accountSelector')) return;

        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) {
            console.log('Header actions non trouvé');
            return;
        }

        const selector = document.createElement('div');
        selector.className = 'account-selector';
        selector.id = 'accountSelector';
        selector.innerHTML = `
            <button class="account-btn" id="accountBtn">
                <span class="material-icons">account_balance_wallet</span>
                <span id="currentAccountName">${this.accounts[0]?.name || 'Compte'}</span>
                <span class="material-icons">arrow_drop_down</span>
            </button>
            <div class="account-dropdown" id="accountDropdown">
                <div class="account-list" id="accountList"></div>
                <button class="add-account-btn" id="addAccountBtn">
                    <span class="material-icons">add</span>
                    Nouveau compte
                </button>
                <button class="manage-account-btn" id="manageAccountBtn">
                    <span class="material-icons">settings</span>
                    Gérer les comptes
                </button>
            </div>
        `;

        headerActions.insertBefore(selector, headerActions.firstChild);
        this.attachAccountEvents();
        this.renderAccountList();
    }

    attachAccountEvents() {
        const accountBtn = document.getElementById('accountBtn');
        const dropdown = document.getElementById('accountDropdown');
        const addBtn = document.getElementById('addAccountBtn');
        const manageBtn = document.getElementById('manageAccountBtn');

        accountBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        addBtn.addEventListener('click', () => {
            this.showCreateAccountDialog();
            dropdown.classList.remove('active');
        });

        // ✅ NOUVEAU : Événement pour gérer les comptes
        manageBtn.addEventListener('click', () => {
            this.showManageAccountsModal();
            dropdown.classList.remove('active');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });
    }

    // Afficher la modale de gestion des comptes
async showManageAccountsModal() {
    // Récupérer tous les comptes avec leurs statistiques
    const accounts = await this.db.getAllAccounts();
    const accountsWithStats = await this.getAccountsStatistics(accounts);
    
    // Créer la modale
    const modal = document.createElement('div');
    modal.className = 'accounts-modal';
    modal.innerHTML = `
        <div class="accounts-modal-overlay"></div>
        <div class="accounts-modal-container">
            <div class="accounts-modal-header">
                <h2>
                    <span class="material-icons">account_balance_wallet</span>
                    Gérer les comptes
                </h2>
                <button class="modal-close" id="closeAccountsModal">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="accounts-modal-body">
                <div class="accounts-list-container" id="accountsManageList">
                    ${this.renderAccountsManageList(accountsWithStats)}
                </div>
            </div>
            <div class="accounts-modal-footer">
                <button class="btn-secondary" id="cancelAccountsModal">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animation d'entrée
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Gestionnaires d'événements
    const closeBtn = modal.querySelector('#closeAccountsModal');
    const cancelBtn = modal.querySelector('#cancelAccountsModal');
    const overlay = modal.querySelector('.accounts-modal-overlay');
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // Attacher les événements aux boutons d'action
    this.attachAccountActionEvents(modal, closeModal);
}

// Récupérer les statistiques des comptes
async getAccountsStatistics(accounts) {
    // Utiliser la méthode qui récupère TOUTES les dépenses
    const allExpenses = await this.db.getAllExpensesForAllAccounts();
    
    console.log('📊 Toutes les dépenses (tous comptes confondus):', allExpenses.length);
    
    const accountsWithStats = [];
    
    for (const account of accounts) {
        // Filtrer les dépenses par accountId
        const accountExpenses = allExpenses.filter(expense => expense.accountId === account.id);
        const total = accountExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        const count = accountExpenses.length;
        
        console.log(`📊 Compte "${account.name}": ${count} dépenses, total: ${total.toFixed(2)} FCFA`);
        
        accountsWithStats.push({
            ...account,
            total: total,
            count: count,
            currency: account.currency || 'FCFA'
        });
    }
    
    return accountsWithStats;
}

// Afficher la liste des comptes dans la modale
renderAccountsManageList(accounts) {
    console.log('Rendu de la liste des comptes avec stats:', accounts);
    if (accounts.length === 0) {
        return '<div class="no-accounts">Aucun compte trouvé</div>';
    }
    
    const currentAccountId = this.db.currentAccount;
    
    return accounts.map(account => {
        const isCurrent = account.id === currentAccountId;
        const symbol = this.getCurrencySymbol(account.currency);
        
        return `
            <div class="account-manage-item ${isCurrent ? 'current' : ''}" data-account-id="${account.id}">
                <div class="account-manage-icon">
                    <span class="material-icons">${account.icon || 'account_balance_wallet'}</span>
                </div>
                <div class="account-manage-info">
                    <div class="account-manage-name">
                        ${account.name}
                        ${isCurrent ? '<span class="current-badge">Actuel</span>' : ''}
                    </div>
                    <div class="account-manage-stats">
                        <span class="stat">
                            <span class="material-icons">receipt</span>
                            ${account.count} dépense${account.count > 1 ? 's' : ''}
                        </span>
                        <span class="stat">
                            <span class="material-icons">money</span>
                            ${account.total.toFixed(2)}
                        </span>
                    </div>
                </div>
                <div class="account-manage-actions">
                    <button class="edit-account-btn" title="Modifier le nom">
                        <span class="material-icons">edit</span>
                    </button>
                    ${!isCurrent ? `
                        <button class="delete-account-btn" title="Supprimer le compte">
                            <span class="material-icons">delete</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Récupérer un paramètre spécifique du compte courant
async getAccountSetting(key) {
    const accountId = await this.ensureCurrentAccount();
    if (!accountId) return null;
    
    return new Promise((resolve) => {
        const transaction = this.db.transaction(['accounts'], 'readonly');
        const store = transaction.objectStore('accounts');
        const request = store.get(accountId);
        
        request.onsuccess = () => {
            const account = request.result;
            if (account && account[key] !== undefined) {
                resolve(account[key]);
            } else {
                // Valeur par défaut selon le type de clé
                const defaultValues = {
                    budget: 1000,
                    currency: 'EUR',
                    format: 'space',
                    theme: 'light',
                    notificationsEnabled: true,
                    reminderTime: '20:00',
                    autoBackup: false,
                    backupFrequency: '7',
                    storageLocation: 'local'
                };
                resolve(defaultValues[key] || null);
            }
        };
        request.onerror = () => {
            resolve(null);
        };
    });
}

// Attacher les événements aux boutons d'action
attachAccountActionEvents(modal, closeModal) {
    // Édition du nom
    modal.querySelectorAll('.edit-account-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = btn.closest('.account-manage-item');
            const accountId = parseInt(item.dataset.accountId);
            const currentName = item.querySelector('.account-manage-name').childNodes[0].textContent.trim();
            
            await this.showEditAccountDialog(accountId, currentName, closeModal);
        });
    });
    
    // Suppression de compte
    modal.querySelectorAll('.delete-account-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = btn.closest('.account-manage-item');
            const accountId = parseInt(item.dataset.accountId);
            
            await this.showDeleteAccountConfirm(accountId, closeModal);
        });
    });
}

// Afficher la boîte de dialogue d'édition
async showEditAccountDialog(accountId, currentName, closeModal) {
    const dialog = document.createElement('div');
    dialog.className = 'account-edit-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-container">
            <div class="dialog-header">
                <h3>Modifier le compte</h3>
                <button class="dialog-close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="dialog-body">
                <div class="form-group">
                    <label>Nom du compte</label>
                    <input type="text" id="editAccountName" value="${currentName}" autofocus>
                </div>
            </div>
            <div class="dialog-footer">
                <button class="btn-cancel" id="cancelEdit">Annuler</button>
                <button class="btn-save" id="saveEdit">Enregistrer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('active'), 10);
    
    const closeDialog = () => {
        dialog.classList.remove('active');
        setTimeout(() => dialog.remove(), 300);
    };
    
    dialog.querySelector('.dialog-close').addEventListener('click', closeDialog);
    dialog.querySelector('.dialog-overlay').addEventListener('click', closeDialog);
    document.getElementById('cancelEdit').addEventListener('click', closeDialog);
    
    document.getElementById('saveEdit').addEventListener('click', async () => {
        const newName = document.getElementById('editAccountName').value.trim();
        if (newName && newName !== currentName) {
            await this.updateAccountName(accountId, newName);
            closeDialog();
            closeModal();
            this.showManageAccountsModal(); // Recharger la modale
            if (window.app) window.app.loadExpenses();
        }
    });
}

// Mettre à jour le nom du compte
async updateAccountName(accountId, newName) {
    return new Promise((resolve, reject) => {
        const transaction = this.db.db.transaction(['accounts'], 'readwrite');
        const store = transaction.objectStore('accounts');
        const request = store.get(accountId);
        
        request.onsuccess = () => {
            const account = request.result;
            if (account) {
                account.name = newName;
                account.updatedAt = new Date().toISOString();
                const updateRequest = store.put(account);
                updateRequest.onsuccess = () => {
                    // Mettre à jour l'affichage du nom courant
                    const currentNameSpan = document.getElementById('currentAccountName');
                    if (currentNameSpan && this.db.currentAccount === accountId) {
                        currentNameSpan.textContent = newName;
                    }
                    if (window.app) {
                        window.app.showNotification('Compte renommé avec succès', 'success');
                    }
                    resolve();
                };
                updateRequest.onerror = reject;
            } else {
                reject(new Error('Compte non trouvé'));
            }
        };
        request.onerror = reject;
    });
}

// Afficher la confirmation de suppression
async showDeleteAccountConfirm(accountId, closeModal) {
    // Récupérer toutes les dépenses
    const allExpenses = await this.getAllExpensesFromAllAccounts();
    const accountExpenses = allExpenses.filter(e => e.accountId === accountId);
    const total = accountExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    // ✅ CORRIGÉ : Utiliser directement la devise et getCurrencySymbol
    const currency = 'XOF'; // Devise par défaut
    const symbol = this.getCurrencySymbol(currency);
    
    const dialog = document.createElement('div');
    dialog.className = 'account-delete-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-container warning">
            <div class="dialog-header">
                <span class="material-icons">warning</span>
                <h3>Supprimer le compte</h3>
            </div>
            <div class="dialog-body">
                <p>Êtes-vous sûr de vouloir supprimer ce compte ?</p>
                <div class="delete-stats">
                    <div class="stat-item">
                        <span class="material-icons">receipt</span>
                        ${accountExpenses.length} dépense(s)
                    </div>
                    <div class="stat-item">
                        <span class="material-icons">euro</span>
                        ${total.toFixed(2)} ${symbol}
                    </div>
                </div>
                <p class="warning-text">⚠️ Cette action est irréversible !</p>
            </div>
            <div class="dialog-footer">
                <button class="btn-cancel" id="cancelDelete">Annuler</button>
                <button class="btn-danger" id="confirmDelete">Supprimer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('active'), 10);
    
    const closeDialog = () => {
        dialog.classList.remove('active');
        setTimeout(() => dialog.remove(), 300);
    };
    
    dialog.querySelector('.dialog-overlay').addEventListener('click', closeDialog);
    dialog.querySelector('#cancelDelete').addEventListener('click', closeDialog);
    
    dialog.querySelector('#confirmDelete').addEventListener('click', async () => {
        await this.deleteAccount(accountId, accountExpenses);
        closeDialog();
        closeModal();
        this.showManageAccountsModal();
        if (window.app) window.app.loadExpenses();
    });
}
// Supprimer un compte et ses dépenses
async deleteAccount(accountId, expenses) {
    // Supprimer toutes les dépenses du compte
    for (const expense of expenses) {
        await this.db.deleteExpense(expense.id);
    }
    
    // Supprimer le compte
    return new Promise((resolve, reject) => {
        const transaction = this.db.db.transaction(['accounts'], 'readwrite');
        const store = transaction.objectStore('accounts');
        const request = store.delete(accountId);
        
        request.onsuccess = () => {
            // Si le compte supprimé était le compte courant, basculer vers un autre compte
            if (this.db.currentAccount === accountId) {
                this.switchToAnotherAccount();
            }
            
            if (window.app) {
                window.app.showNotification('Compte supprimé avec succès', 'success');
            }
            resolve();
        };
        request.onerror = reject;
    });
}

// Basculer vers un autre compte après suppression
async switchToAnotherAccount() {
    const accounts = await this.db.getAllAccounts();
    if (accounts.length > 0) {
        await this.db.switchAccount(accounts[0].id);
        document.getElementById('currentAccountName').textContent = accounts[0].name;
        if (window.app) window.app.loadExpenses();
    }
}

// Obtenir le symbole de la devise
getCurrencySymbol(currency) {
    const symbols = {
        'EUR': '€', 'USD': '$', 'GBP': '£', 'CHF': 'CHF', 'CAD': 'C$',
        'JPY': '¥', 'CNY': '¥', 'XOF': 'FCFA', 'XAF': 'FCFA', 'MAD': 'MAD',
        'DZD': 'DA', 'TND': 'DT', 'NGN': '₦', 'ZAR': 'R', 'BRL': 'R$',
        'RUB': '₽', 'INR': '₹', 'AUD': 'A$'
    };
    return symbols[currency] || 'FCFA';
}

    renderAccountList() {
        const list = document.getElementById('accountList');
        if (!list) return;

        list.innerHTML = this.accounts.map(account => `
            <div class="account-item ${account.id === this.db.currentAccount ? 'active' : ''}" 
                 data-account-id="${account.id}">
                <span class="material-icons">${account.icon || 'account_balance_wallet'}</span>
                <span class="account-name">${account.name}</span>
                ${account.id === this.db.currentAccount ? '<span class="material-icons check">check</span>' : ''}
            </div>
        `).join('');

        list.querySelectorAll('.account-item').forEach(item => {
            item.addEventListener('click', async () => {
                const accountId = parseInt(item.dataset.accountId);
                await this.db.switchAccount(accountId);
                document.getElementById('currentAccountName').textContent = 
                    this.accounts.find(a => a.id === accountId)?.name;
                this.renderAccountList();
                if (window.app) window.app.loadExpenses();
            });
        });
    }

    showCreateAccountDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'account-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Nouveau compte</h3>
                <input type="text" id="newAccountName" placeholder="Nom du compte" autofocus>
                <div class="dialog-buttons">
                    <button class="btn-cancel" id="cancelAccount">Annuler</button>
                    <button class="btn-create" id="createAccount">Créer</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        document.getElementById('createAccount').addEventListener('click', async () => {
            const name = document.getElementById('newAccountName').value.trim();
            if (name) {
                await this.createAccount(name);
                dialog.remove();
            }
        });

        document.getElementById('cancelAccount').addEventListener('click', () => {
            dialog.remove();
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }

    async createAccount(name) {
        const transaction = this.db.db.transaction(['accounts'], 'readwrite');
        const store = transaction.objectStore('accounts');
        
        const newAccount = {
            name: name,
            icon: 'account_balance_wallet',
            createdAt: new Date().toISOString(),
            budget: 1000,
            currency: 'XOF'
        };
        
        const request = store.add(newAccount);
        
        request.onsuccess = (e) => {
            const accountId = e.target.result;
            this.accounts.push({ id: accountId, ...newAccount });
            this.db.switchAccount(accountId);
            document.getElementById('currentAccountName').textContent = name;
            this.renderAccountList();
            if (window.app) window.app.showNotification(`Compte "${name}" créé`, 'success');
        };
    }
}
