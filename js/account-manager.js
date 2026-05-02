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
        } else {
            // Définir le compte courant
            const currentId = this.db.currentAccount;
            this.currentAccount = this.accounts.find(a => a.id == currentId) || this.accounts[0];
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
                <span id="currentAccountName">${this.currentAccount?.name || 'Compte'}</span>
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

        manageBtn.addEventListener('click', () => {
            this.showManageAccountsModal();
            dropdown.classList.remove('active');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });
    }

    renderAccountList() {
        const list = document.getElementById('accountList');
        if (!list) return;

        const currentAccountId = this.db.currentAccount;

        list.innerHTML = this.accounts.map(account => {
            const isActive = account.id == currentAccountId;
            return `
                <div class="account-item ${isActive ? 'active' : ''}" data-account-id="${account.id}">
                    <span class="material-icons">${account.icon || 'account_balance_wallet'}</span>
                    <span class="account-name">${account.name}</span>
                    ${isActive ? '<span class="material-icons check">check_circle</span>' : ''}
                </div>
            `;
        }).join('');

        list.querySelectorAll('.account-item').forEach(item => {
            item.addEventListener('click', async () => {
                const accountId = parseInt(item.dataset.accountId);
                await this.switchAccount(accountId);
            });
        });
    }

    async switchAccount(accountId) {
        await this.db.switchAccount(accountId);
        
        // Mettre à jour la référence locale
        this.currentAccount = this.accounts.find(a => a.id === accountId);
        
        // Mettre à jour l'affichage
        const currentNameSpan = document.getElementById('currentAccountName');
        if (currentNameSpan) {
            currentNameSpan.textContent = this.currentAccount?.name || 'Compte';
        }
        
        // Recharger la liste
        this.renderAccountList();
        
        // Recharger les dépenses et les paramètres
        if (window.app) {
            const settings = await this.db.getAccountSettings();
            window.app.applyAccountSettings(settings);
            window.app.loadExpenses();
            window.app.showNotification(`Compte "${this.currentAccount?.name}" activé`, 'success');
        }
    }

    // ============================================
    // MÉTHODES DE RÉCUPÉRATION DES DONNÉES
    // ============================================

    async getAllExpensesFromAllAccounts() {
        return new Promise((resolve) => {
            if (!this.db.db) {
                resolve([]);
                return;
            }
            
            try {
                const transaction = this.db.db.transaction(['expenses'], 'readonly');
                const store = transaction.objectStore('expenses');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    resolve(request.result || []);
                };
                request.onerror = () => {
                    console.error('Erreur getAllExpensesFromAllAccounts:', request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error('Erreur getAllExpensesFromAllAccounts:', error);
                resolve([]);
            }
        });
    }

    async getAccountsStatistics(accounts) {
        const allExpenses = await this.getAllExpensesFromAllAccounts();
        
        const accountsWithStats = [];
        
        for (const account of accounts) {
            const accountExpenses = allExpenses.filter(e => e.accountId === account.id);
            const total = accountExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const count = accountExpenses.length;
            
            accountsWithStats.push({
                ...account,
                total: total,
                count: count,
                currency: account.currency || 'XOF'
            });
        }
        
        return accountsWithStats;
    }

    getCurrencySymbol(currency) {
        const symbols = {
            'EUR': '€', 'USD': '$', 'GBP': '£', 'CHF': 'CHF', 'CAD': 'C$',
            'JPY': '¥', 'CNY': '¥', 'XOF': 'FCFA', 'XAF': 'FCFA', 'MAD': 'MAD',
            'DZD': 'DA', 'TND': 'DT', 'NGN': '₦', 'ZAR': 'R', 'BRL': 'R$',
            'RUB': '₽', 'INR': '₹', 'AUD': 'A$'
        };
        return symbols[currency] || 'FCFA';
    }

    // ============================================
    // MODALE DE GESTION DES COMPTES
    // ============================================

    async showManageAccountsModal() {
        const accounts = await this.db.getAllAccounts();
        const accountsWithStats = await this.getAccountsStatistics(accounts);
        
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
                    <button class="btn-secondary" id="cancelAccountsModal">Fermer</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('#closeAccountsModal').addEventListener('click', closeModal);
        modal.querySelector('#cancelAccountsModal').addEventListener('click', closeModal);
        modal.querySelector('.accounts-modal-overlay').addEventListener('click', closeModal);
        
        this.attachAccountActionEvents(modal, closeModal);
    }

    renderAccountsManageList(accounts) {
        if (accounts.length === 0) {
            return '<div class="no-accounts">Aucun compte trouvé</div>';
        }
        
        const currentAccountId = this.db.currentAccount;
        const symbol = this.getCurrencySymbol('XOF');
        
        return accounts.map(account => {
            const isCurrent = account.id === currentAccountId;
            
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
                                <span class="material-icons">euro</span>
                                ${account.total.toFixed(2)} ${symbol}
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

    attachAccountActionEvents(modal, closeModal) {
        // Édition du nom
        modal.querySelectorAll('.edit-account-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = btn.closest('.account-manage-item');
                const accountId = parseInt(item.dataset.accountId);
                const nameSpan = item.querySelector('.account-manage-name');
                const currentName = nameSpan.childNodes[0].textContent.trim();
                
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

    // ============================================
    // ÉDITION ET SUPPRESSION DE COMPTES
    // ============================================

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
        dialog.querySelector('#cancelEdit').addEventListener('click', closeDialog);
        
        dialog.querySelector('#saveEdit').addEventListener('click', async () => {
            const newName = dialog.querySelector('#editAccountName').value.trim();
            if (newName && newName !== currentName) {
                await this.updateAccountName(accountId, newName);
                closeDialog();
                closeModal();
                this.showManageAccountsModal();
                if (window.app) window.app.loadExpenses();
            }
        });
    }

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

    async showDeleteAccountConfirm(accountId, closeModal) {
        const allExpenses = await this.getAllExpensesFromAllAccounts();
        const accountExpenses = allExpenses.filter(e => e.accountId === accountId);
        const total = accountExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        
        const symbol = this.getCurrencySymbol('XOF');
        
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

    async deleteAccount(accountId, expenses) {
        // Supprimer toutes les dépenses du compte
        for (const expense of expenses) {
            await this.db.deleteExpense(expense.id);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.db.transaction(['accounts'], 'readwrite');
            const store = transaction.objectStore('accounts');
            const request = store.delete(accountId);
            
            request.onsuccess = () => {
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

    async switchToAnotherAccount() {
        const accounts = await this.db.getAllAccounts();
        if (accounts.length > 0) {
            await this.db.switchAccount(accounts[0].id);
            const nameSpan = document.getElementById('currentAccountName');
            if (nameSpan) nameSpan.textContent = accounts[0].name;
            if (window.app) window.app.loadExpenses();
        }
    }

    // ============================================
    // CRÉATION DE COMPTE
    // ============================================

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

        const createBtn = dialog.querySelector('#createAccount');
        const cancelBtn = dialog.querySelector('#cancelAccount');

        createBtn.addEventListener('click', async () => {
            const name = dialog.querySelector('#newAccountName').value.trim();
            if (name) {
                await this.createAccount(name);
                dialog.remove();
            }
        });

        cancelBtn.addEventListener('click', () => {
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
            currency: 'XOF',
            format: 'space',
            theme: 'light'
        };
        
        const request = store.add(newAccount);
        
        request.onsuccess = (e) => {
            const accountId = e.target.result;
            this.accounts.push({ id: accountId, ...newAccount });
            this.db.switchAccount(accountId);
            
            const nameSpan = document.getElementById('currentAccountName');
            if (nameSpan) nameSpan.textContent = name;
            
            this.renderAccountList();
            
            if (window.app) {
                window.app.showNotification(`Compte "${name}" créé`, 'success');
                window.app.loadExpenses();
            }
        };
    }
}
