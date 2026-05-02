// Gestion de la base de données IndexedDB
class ExpenseDatabase {
    constructor() {
        this.dbName = 'ExpenseDB';
        this.dbVersion = 5; // ← PASSER À 5 pour forcer la recréation
        this.db = null;
        this.currentAccount = localStorage.getItem('currentAccount') || null;
    }

    // Initialiser la base de données
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Erreur ouverture DB');
                reject(request.error);
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                console.log('✅ Base de données ouverte');
                await this.ensureCurrentAccount();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const transaction = event.target.transaction;
                
                console.log(`🔄 Migration de v${oldVersion} vers v${this.dbVersion}`);
                
                // 1. CRÉER LE STORE DES COMPTES
                if (!db.objectStoreNames.contains('accounts')) {
                    const accountStore = db.createObjectStore('accounts', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    accountStore.createIndex('name', 'name', { unique: false });
                    console.log('✅ Store "accounts" créé');
                }
                
                // 2. CRÉER/METTRE À JOUR LE STORE expenses
                let expenseStore;
                if (db.objectStoreNames.contains('expenses')) {
                    expenseStore = transaction.objectStore('expenses');
                } else {
                    expenseStore = db.createObjectStore('expenses', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    expenseStore.createIndex('name', 'name', { unique: false });
                    expenseStore.createIndex('date', 'date', { unique: false });
                    expenseStore.createIndex('synced', 'synced', { unique: false });
                }
                
                // 3. AJOUTER L'INDEX accountId
                if (!expenseStore.indexNames.contains('accountId')) {
                    expenseStore.createIndex('accountId', 'accountId', { unique: false });
                    console.log('✅ Index "accountId" ajouté');
                }
                
                // 4. CRÉER UN COMPTE PAR DÉFAUT ET MIGRER LES DONNÉES
                const accountStore = transaction.objectStore('accounts');
                const defaultAccount = {
                    name: 'Personnel',
                    icon: 'person',
                    createdAt: new Date().toISOString(),
                    budget: 1000,
                    currency: 'XOF',
                    format: 'space',
                    theme: 'light',
                    notificationsEnabled: true,
                    reminderTime: '20:00'
                };
                
                const addAccount = accountStore.add(defaultAccount);
                
                addAccount.onsuccess = (e) => {
                    const defaultAccountId = e.target.result;
                    console.log(`✅ Compte par défaut créé avec ID: ${defaultAccountId}`);
                    
                    // Migrer les anciennes dépenses
                    const expenseRequest = expenseStore.getAll();
                    expenseRequest.onsuccess = () => {
                        const oldExpenses = expenseRequest.result;
                        let count = 0;
                        
                        oldExpenses.forEach(expense => {
                            if (!expense.accountId) {
                                expense.accountId = defaultAccountId;
                                expenseStore.put(expense);
                                count++;
                            }
                        });
                        
                        console.log(`✅ ${count} dépenses migrées`);
                    };
                };
            };
        });
    }

    // ============================================
    // GESTION DES COMPTES
    // ============================================

    // Récupérer tous les comptes
    getAllAccounts() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            if (!this.db.objectStoreNames.contains('accounts')) {
                resolve([]);
                return;
            }
            
            try {
                const transaction = this.db.transaction(['accounts'], 'readonly');
                const store = transaction.objectStore('accounts');
                const request = store.getAll();
                
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch (error) {
                console.error('Erreur getAllAccounts:', error);
                resolve([]);
            }
        });
    }

    // Récupérer TOUTES les dépenses (sans filtre par compte)
    getAllExpensesForAllAccounts() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            try {
                const transaction = this.db.transaction(['expenses'], 'readonly');
                const store = transaction.objectStore('expenses');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    resolve(request.result || []);
                };
                request.onerror = () => {
                    console.error('Erreur getAllExpensesForAllAccounts:', request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error('Erreur getAllExpensesForAllAccounts:', error);
                resolve([]);
            }
        });
    }

    // S'assurer qu'un compte courant est défini
    async ensureCurrentAccount() {
        if (!this.currentAccount) {
            const accounts = await this.getAllAccounts();
            if (accounts && accounts.length > 0) {
                this.currentAccount = accounts[0].id;
                localStorage.setItem('currentAccount', this.currentAccount);
                console.log(`📌 Compte courant défini: ${this.currentAccount}`);
            }
        }
        return this.currentAccount;
    }

    // Changer de compte
    switchAccount(accountId) {
        this.currentAccount = accountId;
        localStorage.setItem('currentAccount', accountId);
        console.log(`🔁 Compte changé vers ID: ${accountId}`);
        return this.getAllExpenses();
    }

    // ============================================
    // GESTION DES DÉPENSES
    // ============================================

    // Ajouter une dépense
    addExpense(expense) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Base non initialisée'));
                return;
            }
            
            const accountId = await this.ensureCurrentAccount();
            if (!accountId) {
                reject(new Error('Aucun compte disponible'));
                return;
            }
            
            const transaction = this.db.transaction(['expenses'], 'readwrite');
            const store = transaction.objectStore('expenses');
            
            const localId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
            const newExpense = {
                ...expense,
                localId: localId,
                accountId: accountId,
                synced: "0",
                createdAt: new Date().toISOString()
            };
            
            const request = store.add(newExpense);

            request.onsuccess = () => {
                resolve({ ...newExpense, id: request.result });
            };

            request.onerror = (error) => {
                reject(error);
            };
        });
    }

    // Récupérer toutes les dépenses (du compte courant)
    getAllExpenses() {
        return new Promise(async (resolve) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            const accountId = await this.ensureCurrentAccount();
            if (!accountId) {
                resolve([]);
                return;
            }
            
            try {
                const transaction = this.db.transaction(['expenses'], 'readonly');
                const store = transaction.objectStore('expenses');
                
                if (store.indexNames.contains('accountId')) {
                    const index = store.index('accountId');
                    const request = index.getAll(accountId);
                    
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => this.fallbackGetAllExpenses(accountId, resolve);
                } else {
                    this.fallbackGetAllExpenses(accountId, resolve);
                }
            } catch (error) {
                console.error('Erreur getAllExpenses:', error);
                resolve([]);
            }
        });
    }

    // Méthode de secours
    fallbackGetAllExpenses(accountId, resolve) {
        try {
            const transaction = this.db.transaction(['expenses'], 'readonly');
            const store = transaction.objectStore('expenses');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const all = request.result || [];
                const filtered = all.filter(e => !e.accountId || e.accountId === accountId);
                resolve(filtered);
            };
            request.onerror = () => resolve([]);
        } catch (error) {
            console.error('Erreur fallback:', error);
            resolve([]);
        }
    }

    // Récupérer le budget du compte courant
    async getCurrentBudget() {
        const accountId = await this.ensureCurrentAccount();
        if (!accountId) return 1000;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['accounts'], 'readonly');
            const store = transaction.objectStore('accounts');
            const request = store.get(accountId);
            
            request.onsuccess = () => {
                const account = request.result;
                resolve(account?.budget || 1000);
            };
            request.onerror = () => resolve(1000);
        });
    }

    // Sauvegarder les paramètres du compte courant
    async saveAccountSettings(settings) {
        if (!this.db || !this.currentAccount) return false;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readwrite');
            const store = transaction.objectStore('accounts');
            
            const getRequest = store.get(this.currentAccount);
            
            getRequest.onsuccess = () => {
                const account = getRequest.result;
                if (!account) {
                    resolve(false);
                    return;
                }
                
                const updatedAccount = {
                    ...account,
                    ...settings,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = store.put(updatedAccount);
                
                updateRequest.onsuccess = () => {
                    // Mettre à jour localStorage pour accès rapide
                    const prefix = `account_${this.currentAccount}_`;
                    if (settings.budget !== undefined) {
                        localStorage.setItem(`${prefix}budget`, settings.budget);
                    }
                    resolve(true);
                };
                
                updateRequest.onerror = () => resolve(false);
            };
            
            getRequest.onerror = () => resolve(false);
        });
    }

    // Supprimer une dépense
    deleteExpense(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Base non initialisée'));
                return;
            }
            
            const transaction = this.db.transaction(['expenses'], 'readwrite');
            const store = transaction.objectStore('expenses');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (error) => reject(error);
        });
    }

    // Mettre à jour une dépense
    updateExpense(id, updates) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Base non initialisée'));
                return;
            }
            
            const transaction = this.db.transaction(['expenses'], 'readwrite');
            const store = transaction.objectStore('expenses');
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const expense = getRequest.result;
                if (!expense) {
                    resolve(null);
                    return;
                }
                
                let processedUpdates = { ...updates };
                if (updates.synced !== undefined) {
                    processedUpdates.synced = updates.synced ? "1" : "0";
                }
                
                const updatedExpense = { ...expense, ...processedUpdates };
                const updateRequest = store.put(updatedExpense);
                
                updateRequest.onsuccess = () => resolve(updatedExpense);
                updateRequest.onerror = (error) => reject(error);
            };
            
            getRequest.onerror = (error) => reject(error);
        });
    }

    // Marquer comme synchronisé
    markAsSynced(id) {
        return this.updateExpense(id, { synced: "1" });
    }

    // Récupérer les dépenses non synchronisées
    getUnsyncedExpenses() {
        return this.getAllExpenses().then(expenses => {
            return expenses.filter(exp => 
                exp.synced === "0" || exp.synced === 0 || exp.synced === false
            );
        });
    }

    // Filtrer les dépenses
    filterExpenses(filters = {}) {
        return this.getAllExpenses().then(allExpenses => {
            return allExpenses.filter(expense => {
                let match = true;
                
                if (filters.name && filters.name.trim() !== '') {
                    match = match && expense.name.toLowerCase().includes(filters.name.toLowerCase());
                }
                
                if (filters.date && filters.date.trim() !== '') {
                    const expenseDate = new Date(expense.date).toISOString().split('T')[0];
                    match = match && expenseDate === filters.date;
                }
                
                if (filters.month && filters.month.trim() !== '') {
                    const expenseMonth = new Date(expense.date).toISOString().substring(0, 7);
                    match = match && expenseMonth === filters.month;
                }
                
                return match;
            });
        });
    }
}
