// ============================================
// APPLICATION PRINCIPALE - VERSION CORRIGÉE
// ============================================

class ExpenseApp {
    constructor(db, driveSync) {
        this.db = db;
        this.driveSync = driveSync;
        this.currentFilters = {
            name: '',
            date: '',
            month: ''
        };
        this.currentCurrency = 'XOF';
        this.currentBudget = 1000;
        
        this.initElements();
        this.initEventListeners();
        this.initDatabase();
        this.initFilterChips();
        this.initAutocomplete();
    }

    initElements() {
        this.form = document.getElementById('expenseForm');
        this.expenseName = document.getElementById('expenseName');
        this.expenseAmount = document.getElementById('expenseAmount');
        this.expenseDateTime = document.getElementById('expenseDateTime');
        this.filterName = document.getElementById('filterName');
        this.filterDate = document.getElementById('filterDate');
        this.filterMonth = document.getElementById('filterMonth');
        this.clearFiltersBtn = document.getElementById('clearFilters');
        this.expensesContainer = document.getElementById('expensesContainer');
        this.totalAmountEl = document.getElementById('totalAmount');
        this.expenseCountEl = document.getElementById('expenseCount');
        this.deleteFilteredBtn = document.getElementById('deleteFilteredBtn');
        this.totalBudgetSpan = document.getElementById('totalBudget');
        this.budgetRemainingEl = document.getElementById('budgetRemaining');

        if (this.expenseDateTime) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            this.expenseDateTime.value = now.toISOString().slice(0, 16);
        }
    }

    async initDatabase() {
        try {
            await this.db.init();
            console.log('✅ Base de données initialisée');
            
            // Récupérer les paramètres du compte courant
            const settings = await this.db.getAccountSettings();
            this.applyAccountSettings(settings);
            
            // Mettre à jour l'affichage du budget
            if (this.totalBudgetSpan) {
                this.totalBudgetSpan.textContent = settings.budget || 1000;
            }
            
            // Initialiser les notifications
            if (!window.notificationSystem) {
                window.notificationSystem = new NotificationSystem();
            }
            
            await this.loadExpenses();
            console.log('✅ Google Drive Sync actif');
            
        } catch (error) {
            console.error('❌ Erreur initialisation DB:', error);
            this.showNotification('Erreur d\'initialisation de la base de données', 'error');
        }
    }

    applyAccountSettings(settings) {
        if (!settings) return;
        
        console.log('⚙️ Paramètres du compte chargés:', settings);
        
        this.currentCurrency = settings.currency || 'XOF';
        this.currentBudget = settings.budget || 1000;
        
        // Appliquer le thème
        if (settings.theme) {
            document.body.setAttribute('data-theme', settings.theme);
        }
        
        // Sauvegarder dans localStorage pour compatibilité
        localStorage.setItem('currency', this.currentCurrency);
        localStorage.setItem('budget', this.currentBudget);
    }

    initEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        if (this.filterName) {
            this.filterName.addEventListener('input', () => this.handleFilterChange());
        }
        
        if (this.filterDate) {
            this.filterDate.addEventListener('change', () => this.handleFilterChange());
        }
        
        if (this.filterMonth) {
            this.filterMonth.addEventListener('change', () => this.handleFilterChange());
        }
        
        if (this.clearFiltersBtn) {
            this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
        
        if (this.deleteFilteredBtn) {
            this.deleteFilteredBtn.addEventListener('click', () => this.deleteFilteredExpenses());
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (this.isSubmitting) {
            console.log('Ajout déjà en cours, ignoré');
            return;
        }

        if (!this.expenseName.value || !this.expenseAmount.value || !this.expenseDateTime.value) {
            this.showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }

        this.isSubmitting = true;
        
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-icons rotating">sync</span> Ajout...';

        const expense = {
            name: this.expenseName.value.trim(),
            amount: parseFloat(this.expenseAmount.value),
            date: new Date(this.expenseDateTime.value).toISOString()
        };

        this.showNotification('Ajout en cours...', 'info');
        
        try {
            const addedExpense = await this.db.addExpense(expense);
            this.showNotification('Dépense ajoutée avec succès!', 'success');
            this.form.reset();
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            this.expenseDateTime.value = now.toISOString().slice(0, 16);
            
            this.updateAutocomplete();
            await this.loadExpenses();
            
            if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
                await this.driveSync.syncToDrive();
            }
        } catch (error) {
            this.showNotification('Erreur lors de l\'ajout de la dépense', 'error');
            console.error(error);
        } finally {
            this.isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    handleFilterChange() {
        this.currentFilters = {
            name: this.filterName.value,
            date: this.filterDate.value,
            month: this.filterMonth.value
        };
        this.loadExpenses();
    }

    clearFilters() {
        if (this.filterName) this.filterName.value = '';
        if (this.filterDate) this.filterDate.value = '';
        if (this.filterMonth) this.filterMonth.value = '';
        this.currentFilters = { name: '', date: '', month: '' };
        this.loadExpenses();
    }

    async loadExpenses() {
        try {
            const expenses = await this.db.getAllExpenses();
            const filtered = this.filterExpenses(expenses);
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            this.displayExpenses(filtered);
            this.updateStats(filtered);
            this.updateFilterSummary(filtered);
        } catch (error) {
            console.error('Erreur lors du chargement des dépenses:', error);
        }
    }

    displayExpenses(expenses) {
        if (!this.expensesContainer) return;

        if (expenses.length === 0) {
            this.expensesContainer.innerHTML = `
                <div class="empty-message">
                    <span class="material-icons">receipt</span>
                    <p>Aucune dépense enregistrée</p>
                </div>
            `;
            return;
        }

        this.expensesContainer.innerHTML = expenses.map(expense => this.createExpenseCard(expense)).join('');
    }

    createExpenseCard(expense) {
        const date = new Date(expense.date);
        const formattedDate = window.lang ? window.lang.formatDate(expense.date) : date.toLocaleDateString('fr-FR');
        
        const pendingClass = !expense.synced ? 'pending' : '';
        const pendingIcon = !expense.synced ? '<span class="pending-icon" title="En attente de synchronisation">⏳</span>' : '';
        const symbol = this.getCurrencySymbol(this.currentCurrency);
        
        return `
            <div class="expense-card ${pendingClass}" data-id="${expense.id}">
                <div class="expense-header">
                    <div class="expense-name">
                        <span class="material-icons">shopping_cart</span>
                        ${this.escapeHtml(expense.name)}
                        ${pendingIcon}
                    </div>
                    <div class="expense-amount">
                        ${parseFloat(expense.amount).toFixed(2)} ${symbol}
                    </div>
                </div>
                <div class="expense-date">
                    <span class="material-icons">schedule</span>
                    ${formattedDate}
                </div>
                <div class="expense-actions">
                    <button class="btn-delete" onclick="app.deleteExpense(${expense.id}, event)">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;
    }

    async deleteExpense(id, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
            this.showNotification('Suppression en cours...', 'info');
            
            try {
                await this.db.deleteExpense(id);
                this.showNotification('Dépense supprimée avec succès', 'success');
                await this.loadExpenses();
                
                if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
                    await this.driveSync.syncToDrive();
                }
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                this.showNotification('Erreur lors de la suppression', 'error');
            }
        }
    }

    updateStats(expenses) {
        if (!this.totalAmountEl || !this.expenseCountEl) return;
        
        const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        const symbol = this.getCurrencySymbol(this.currentCurrency);
        
        this.totalAmountEl.textContent = total.toFixed(2) + ' ' + symbol;
        this.expenseCountEl.textContent = expenses.length;
        this.updateBudgetRemaining(total);
    }

    updateBudgetRemaining(total) {
        if (!this.budgetRemainingEl) return;
        
        const budget = this.currentBudget;
        const remaining = budget - total;
        const symbol = this.getCurrencySymbol(this.currentCurrency);
        
        this.budgetRemainingEl.textContent = remaining.toFixed(2) + ' ' + symbol;
        
        if (remaining < 0) {
            this.budgetRemainingEl.style.color = '#ef233c';
        } else if (remaining < 100) {
            this.budgetRemainingEl.style.color = '#ffb703';
        } else {
            this.budgetRemainingEl.style.color = '';
        }
        
        const progressBar = document.querySelector('.budget-progress-bar');
        if (progressBar) {
            const percentageUsed = Math.min((total / budget) * 100, 100);
            progressBar.style.width = percentageUsed + '%';
            progressBar.style.backgroundColor = remaining < 0 ? '#ef233c' : 
                                               percentageUsed >= 90 ? '#ffb703' : '#4361ee';
        }
    }

    updateFilterSummary(filteredExpenses) {
        const filterSummary = document.getElementById('filterSummary');
        const filterCount = document.getElementById('filterCount');
        const filterTotal = document.getElementById('filterTotal');
        
        if (!filterSummary || !filterCount || !filterTotal) return;
        
        const count = filteredExpenses.length;
        const total = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const symbol = this.getCurrencySymbol(this.currentCurrency);
        
        filterCount.textContent = `${count} dépense${count > 1 ? 's' : ''}`;
        filterTotal.textContent = total.toFixed(2) + ' ' + symbol;
        
        const hasActiveFilters = this.hasActiveFilters();
        if (count > 0 && (hasActiveFilters || this.activeFilter !== 'all')) {
            filterSummary.style.display = 'block';
        } else {
            filterSummary.style.display = 'none';
        }
    }

    hasActiveFilters() {
        return (this.currentFilters.name && this.currentFilters.name.trim() !== '') ||
               (this.currentFilters.date && this.currentFilters.date.trim() !== '') ||
               (this.currentFilters.month && this.currentFilters.month.trim() !== '');
    }

    async deleteFilteredExpenses() {
        const allExpenses = await this.db.getAllExpenses();
        const filteredExpenses = this.filterExpenses(allExpenses);
        
        if (filteredExpenses.length === 0) {
            this.showNotification('Aucune dépense à supprimer', 'info');
            return;
        }
        
        const total = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const symbol = this.getCurrencySymbol(this.currentCurrency);
        
        const confirmMessage = `⚠️ Êtes-vous sûr de vouloir supprimer définitivement ${filteredExpenses.length} dépense(s) pour un total de ${total.toFixed(2)} ${symbol} ?\n\nCette action est irréversible !`;
        
        if (!confirm(confirmMessage)) return;
        
        this.showNotification('Suppression en cours...', 'info');
        
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const expense of filteredExpenses) {
            try {
                await this.db.deleteExpense(expense.id);
                deletedCount++;
            } catch (error) {
                errorCount++;
            }
        }
        
        if (errorCount === 0) {
            this.showNotification(`✅ ${deletedCount} dépense(s) supprimée(s) avec succès`, 'success');
        } else {
            this.showNotification(`⚠️ ${deletedCount} supprimée(s), ${errorCount} erreur(s)`, 'warning');
        }
        
        await this.loadExpenses();
        
        if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
            await this.driveSync.syncToDrive();
        }
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

    manualSync() {
        if (!this.driveSync) {
            this.showNotification('Google Drive non configuré', 'error');
            return;
        }
        
        if (!this.driveSync.isAuthenticated) {
            this.showNotification('Veuillez d\'abord vous connecter à Google Drive', 'warning');
            const panel = document.getElementById('drivePanel');
            if (panel) panel.classList.add('active');
            return;
        }
        
        this.showNotification('Synchronisation en cours...', 'info');
        
        this.driveSync.syncToDrive()
            .then(() => {
                this.showNotification('Synchronisation terminée !', 'success');
                return this.loadExpenses();
            })
            .catch(error => {
                this.showNotification('Erreur de synchronisation', 'error');
                console.error(error);
            });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'success') {
        const oldNotifications = document.querySelectorAll('.notification');
        oldNotifications.forEach(n => n.remove());

        const colors = {
            success: '#4cc9f0',
            error: '#f72585',
            info: '#4361ee',
            warning: '#f8961e'
        };

        const icons = {
            success: 'check_circle',
            error: 'error',
            info: 'info',
            warning: 'warning'
        };

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="material-icons">${icons[type] || 'info'}</span>
            <span>${message}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || '#4361ee'};
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            font-weight: 500;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
        }, 3000);
    }

    initFilterChips() {
        this.filterChips = document.querySelectorAll('.filter-chip');
        this.activeFilter = 'all';
        
        this.filterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.applyFilterChip(filter);
            });
        });
    }

    initAutocomplete() {
        setTimeout(() => {
            const expenseNameInput = document.getElementById('expenseName');
            if (expenseNameInput && !window.autocomplete && typeof ExpenseAutocomplete !== 'undefined') {
                window.autocomplete = new ExpenseAutocomplete(expenseNameInput);
                console.log('✅ Autocomplétion initialisée');
            }
        }, 1000);
    }

    updateAutocomplete() {
        if (window.autocomplete) {
            window.autocomplete.loadExpenses();
        }
    }

    applyFilterChip(filter) {
        this.filterChips.forEach(chip => {
            if (chip.dataset.filter === filter) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
        
        this.activeFilter = filter;
        this.loadExpenses();
    }

    filterExpenses(expenses) {
        let filtered = expenses.filter(expense => {
            let match = true;
            
            if (this.currentFilters.name && this.currentFilters.name.trim() !== '') {
                match = match && expense.name.toLowerCase().includes(this.currentFilters.name.toLowerCase());
            }
            
            if (this.currentFilters.date && this.currentFilters.date.trim() !== '') {
                const expenseDate = new Date(expense.date).toISOString().split('T')[0];
                match = match && expenseDate === this.currentFilters.date;
            }
            
            if (this.currentFilters.month && this.currentFilters.month.trim() !== '') {
                const expenseMonth = new Date(expense.date).toISOString().substring(0, 7);
                match = match && expenseMonth === this.currentFilters.month;
            }
            
            return match;
        });
        
        filtered = this.applyPeriodFilter(filtered, this.activeFilter);
        return filtered;
    }

    applyPeriodFilter(expenses, period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch(period) {
            case 'today':
                return expenses.filter(expense => {
                    const expenseDate = new Date(expense.date);
                    return expenseDate >= today && expenseDate < new Date(today.getTime() + 24*60*60*1000);
                });
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);
                return expenses.filter(expense => {
                    const expenseDate = new Date(expense.date);
                    return expenseDate >= weekStart && expenseDate < weekEnd;
                });
            case 'month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                return expenses.filter(expense => {
                    const expenseDate = new Date(expense.date);
                    return expenseDate >= monthStart && expenseDate <= monthEnd;
                });
            default:
                return expenses;
        }
    }
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initialisation de l\'application...');
    
    try {
        addSectionStyles();
        
        const db = new ExpenseDatabase();
        const driveSync = new GoogleDriveSync(db);
        const app = new ExpenseApp(db, driveSync);
        
        window.app = app;
        window.driveSync = driveSync;
        
        setTimeout(() => {
            window.navigation = new NavigationManager();
        }, 200);
        
        new MobileMenu();
        
        setTimeout(() => {
            if (typeof addGoogleDriveButton === 'function') addGoogleDriveButton();
            if (typeof addManualSyncButton === 'function') addManualSyncButton();
            if (typeof addNotificationButton === 'function') addNotificationButton();
        }, 500);

        setTimeout(() => {
            if (window.app && window.app.db) {
                window.accountManager = new AccountManager(window.app.db);
            }
        }, 1500);
        
        const donateBtn = document.getElementById('btn-donate');
        if (donateBtn) {
            donateBtn.addEventListener('click', () => {
                const phoneNumber = '2290166344554';
                const message = 'Bonjour, je souhaiterais effectuer un don. Quel est votre moyen de paiement ?';
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
            });
        }

        console.log('✅ Application initialisée avec succès');

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    }
});

// ============================================
// STYLES ET FONCTIONS UTILITAIRES
// ============================================

function addSectionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .statistics-section, .settings-section {
            display: none;
            animation: fadeIn 0.3s ease;
            margin-top: 24px;
        }
        .stats-placeholder {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .settings-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .settings-card h3 {
            margin-bottom: 15px;
            font-size: 16px;
            color: #2b2d42;
        }
        .setting-item {
            margin-bottom: 15px;
        }
        .setting-item label {
            display: block;
            margin-bottom: 5px;
            color: #8d99ae;
            font-size: 13px;
        }
        .settings-input {
            width: 100%;
            padding: 10px;
            border: 2px solid #edf2f4;
            border-radius: 8px;
            font-size: 14px;
        }
        .settings-input:focus {
            outline: none;
            border-color: #4361ee;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// STYLES PWA
// ============================================

const styles = document.createElement('style');
styles.textContent = `
    .install-prompt {
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        padding: 16px;
        z-index: 2000;
        animation: slideUp 0.3s ease;
        max-width: 300px;
    }
    .install-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .install-header {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
    }
    .install-buttons {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }
    .install-btn {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s ease;
    }
    .install-btn.primary {
        background: #4361ee;
        color: white;
    }
    .install-btn.secondary {
        background: #f8f9fa;
        color: #2b2d42;
    }
    .update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        padding: 16px 20px;
        z-index: 2000;
        animation: slideUp 0.3s ease;
        border-left: 4px solid #4361ee;
    }
    .update-content {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    .btn-update {
        background: #4361ee;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
    }
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(styles);

// ============================================
// SERVICE WORKER
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('✅ Service Worker enregistré'))
            .catch(error => console.error('❌ Erreur Service Worker:', error));
    });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => showInstallPrompt(), 30000);
});

function showInstallPrompt() {
    if (!deferredPrompt) return;
    const prompt = document.createElement('div');
    prompt.className = 'install-prompt';
    prompt.id = 'installPrompt';
    prompt.innerHTML = `
        <div class="install-content">
            <div class="install-header">
                <span class="material-icons">install_mobile</span>
                <span>Installer l'application</span>
            </div>
            <p>Installez Gestion Dépenses sur votre appareil pour un accès rapide.</p>
            <div class="install-buttons">
                <button class="install-btn primary" id="installBtn">Installer</button>
                <button class="install-btn secondary" id="laterBtn">Plus tard</button>
            </div>
        </div>
    `;
    document.body.appendChild(prompt);
    
    document.getElementById('installBtn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            prompt.remove();
        }
    });
    
    document.getElementById('laterBtn').addEventListener('click', () => prompt.remove());
}

window.addEventListener('appinstalled', () => {
    console.log('✅ Application installée');
    document.getElementById('installPrompt')?.remove();
});
