// Application principale - Adaptée pour GoogleDriveSync
class ExpenseApp {
    constructor(db, driveSync) {
        this.db = db;
        this.driveSync = driveSync;  // Renommé pour clarté
        this.currentFilters = {
            name: '',
            date: '',
            month: ''
        };
        
        this.initElements();
        this.initEventListeners();
        this.initDatabase();

        // ✅ AJOUTER CETTE LIGNE
        this.initFilterChips();
        this.initAutocomplete();

    }

    // Initialiser les éléments DOM
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
        this.totalBudget = document.getElementById('totalBudget');

        // Définir la date et heure par défaut à maintenant
        if (this.expenseDateTime) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            this.expenseDateTime.value = now.toISOString().slice(0, 16);
        }
    }

    // Dans ExpenseApp, après l'initialisation de la DB
    initDatabase() {
        this.db.init()
            .then(async () => {
                console.log('Base de données initialisée');
                
                // ✅ Charger le budget initial depuis le compte courant
                const budget = await this.db.getCurrentBudget();
                const totalBudgetSpan = document.getElementById('totalBudget');
                if (totalBudgetSpan) {
                    totalBudgetSpan.textContent = budget;
                }
                
                // Initialiser les notifications MAINTENANT que la DB est prête
                if (!window.notificationSystem) {
                    window.notificationSystem = new NotificationSystem();
                }
                
                return this.loadExpenses();
            })
            .then(() => {
                console.log('Google Drive Sync actif');
            })
            .catch(error => {
                console.error('Erreur initialisation DB:', error);
                this.showNotification('Erreur d\'initialisation de la base de données', 'error');
            });
    }

    // Initialiser les écouteurs d'événements
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
            this.deleteFilteredBtn.addEventListener('click', () => {
                this.deleteFilteredExpenses();
            });
        }

    }

    // Gérer la soumission du formulaire
    handleSubmit(e) {
        e.preventDefault();

        // PROTECTION ANTI-DOUBLON
        if (this.isSubmitting) {
            console.log('Ajout déjà en cours, ignoré');
            return;
        }

        if (!this.expenseName.value || !this.expenseAmount.value || !this.expenseDateTime.value) {
            this.showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }

        // Marquer comme en cours de soumission
        this.isSubmitting = true;
        
        // Désactiver le bouton
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-icons rotating">sync</span> Ajout...';

        const expense = {
            name: this.expenseName.value.trim(), // .trim() pour enlever les espaces
            amount: parseFloat(this.expenseAmount.value),
            date: new Date(this.expenseDateTime.value).toISOString()
        };

        this.showNotification('Ajout en cours...', 'info');
        
        this.db.addExpense(expense)
            .then((addedExpense) => {
                this.showNotification('Dépense ajoutée avec succès!', 'success');
                this.form.reset();
                
                // Remettre la date par défaut
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                this.expenseDateTime.value = now.toISOString().slice(0, 16);
                
                return this.loadExpenses();
            })
            .then((addedExpense) => {
                this.showNotification('Dépense ajoutée avec succès!', 'success');
                this.form.reset();
                
                // Remettre la date par défaut
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                this.expenseDateTime.value = now.toISOString().slice(0, 16);
                
                // ✅ AJOUTER CETTE LIGNE
                this.updateAutocomplete();
                
                return this.loadExpenses();
            })
            .then(() => {
                // Déclencher la synchronisation si en ligne
                if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
                    return this.driveSync.syncToDrive();
                }
            })
            .catch(error => {
                this.showNotification('Erreur lors de l\'ajout de la dépense', 'error');
                console.error(error);
            })
            .finally(() => {
                // TOUJOURS réactiver le bouton, même en cas d'erreur
                this.isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            });
    }

    // Mettre à jour l'affichage du résumé du filtre
    updateFilterSummary(filteredExpenses) {
        const filterSummary = document.getElementById('filterSummary');
        const filterCount = document.getElementById('filterCount');
        const filterTotal = document.getElementById('filterTotal');
        
        if (!filterSummary || !filterCount || !filterTotal) return;
        
        const count = filteredExpenses.length;
        const total = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        // Obtenir le symbole de la devise
        const currency = this.currentCurrency || localStorage.getItem('currency') || 'EUR';
        const symbol = this.getCurrencySymbol(currency);
        
        filterCount.textContent = `${count} dépense${count > 1 ? 's' : ''}`;
        filterTotal.textContent = total.toFixed(2) + ' ' + symbol;
        
        // Afficher le résumé s'il y a des filtres actifs ou des dépenses
        const hasActiveFilters = this.hasActiveFilters();
        if (count > 0 && (hasActiveFilters || this.activeFilter !== 'all')) {
            filterSummary.style.display = 'block';
        } else {
            filterSummary.style.display = 'none';
        }
    }

    // Vérifier si des filtres sont actifs
    hasActiveFilters() {
        return (this.currentFilters.name && this.currentFilters.name.trim() !== '') ||
            (this.currentFilters.date && this.currentFilters.date.trim() !== '') ||
            (this.currentFilters.month && this.currentFilters.month.trim() !== '');
    }

    // Supprimer toutes les dépenses du filtre courant
    async deleteFilteredExpenses() {
        // Récupérer les dépenses filtrées
        const allExpenses = await this.db.getAllExpenses();
        const filteredExpenses = this.filterExpenses(allExpenses);
        
        if (filteredExpenses.length === 0) {
            this.showNotification('Aucune dépense à supprimer', 'info');
            return;
        }
        
        // Confirmation
        const total = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const currency = this.currentCurrency || localStorage.getItem('currency') || 'EUR';
        const symbol = this.getCurrencySymbol(currency);
        
        const confirmMessage = `⚠️ Êtes-vous sûr de vouloir supprimer définitivement ${filteredExpenses.length} dépense(s) pour un total de ${total.toFixed(2)} ${symbol} ?\n\nCette action est irréversible !`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        this.showNotification('Suppression en cours...', 'info');
        
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const expense of filteredExpenses) {
            try {
                await this.db.deleteExpense(expense.id);
                deletedCount++;
            } catch (error) {
                console.error('Erreur suppression:', error);
                errorCount++;
            }
        }
        
        if (errorCount === 0) {
            this.showNotification(`✅ ${deletedCount} dépense(s) supprimée(s) avec succès`, 'success');
        } else {
            this.showNotification(`⚠️ ${deletedCount} supprimée(s), ${errorCount} erreur(s)`, 'warning');
        }
        
        // Recharger l'affichage
        await this.loadExpenses();
        
        // Déclencher la synchronisation
        if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
            await this.driveSync.syncToDrive();
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
        return symbols[currency] || '€';
    }

    // Gérer les changements de filtres
    handleFilterChange() {
        this.currentFilters = {
            name: this.filterName.value,
            date: this.filterDate.value,
            month: this.filterMonth.value
        };
        
        this.loadExpenses();
    }

    // Effacer tous les filtres
    clearFilters() {
        if (this.filterName) this.filterName.value = '';
        if (this.filterDate) this.filterDate.value = '';
        if (this.filterMonth) this.filterMonth.value = '';
        this.currentFilters = { name: '', date: '', month: '' };
        this.loadExpenses();
    }

    // Charger et afficher les dépenses
    loadExpenses() {
        return this.db.getAllExpenses()
            .then(expenses => {
                // Appliquer les filtres
                const filtered = this.filterExpenses(expenses);
                
                // Trier par date (plus récent d'abord)
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Afficher les dépenses
                this.displayExpenses(filtered);
                
                // Mettre à jour les statistiques
                this.updateStats(filtered);
                
                // ✅ NOUVEAU : Mettre à jour le résumé du filtre
                this.updateFilterSummary(filtered);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des dépenses:', error);
            });
    }

    // Afficher les dépenses
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

    // Créer une carte de dépense
    createExpenseCard(expense) {
        const date = new Date(expense.date);
        // const formattedDate = date.toLocaleDateString('fr-FR', {
        //     year: 'numeric',
        //     month: 'long',
        //     day: 'numeric',
        //     hour: '2-digit',
        //     minute: '2-digit'
        // });

        const formattedDate = window.lang.formatDate(expense.date);

        // Vérifier si la dépense est synchronisée
        const pendingClass = !expense.synced ? 'pending' : '';
        const pendingIcon = !expense.synced ? '<span class="pending-icon" title="En attente de synchronisation">⏳</span>' : '';
        const currency = localStorage.getItem('currency') || 'XOF';
        // Dans createExpenseCard(), remplace :


        return `
            <div class="expense-card ${pendingClass}" data-id="${expense.id}">
                <div class="expense-header">
                    <div class="expense-name">
                        <span class="material-icons">shopping_cart</span>
                        ${this.escapeHtml(expense.name)}
                        ${pendingIcon}
                    </div>
                    <div class="expense-amount">
                        ${parseFloat(expense.amount).toFixed(2)} ${currency}
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

    // Supprimer une dépense
    deleteExpense(id, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
            this.showNotification('Suppression en cours...', 'info');
            
            this.db.deleteExpense(id)
                .then(() => {
                    this.showNotification('Dépense supprimée avec succès', 'success');
                    return this.loadExpenses();
                })
                .then(() => {
                    // Google Drive Sync synchronisera la suppression à la prochaine synchro
                    // Pas besoin d'appeler deleteExpense, le prochain syncToDrive() mettra à jour
                    if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
                        // Optionnel : déclencher une synchro immédiate
                        // this.driveSync.syncToDrive();
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la suppression:', error);
                    this.showNotification('Erreur lors de la suppression', 'error');
                });
        }
    }

    // Mettre à jour l'affichage du budget
    updateBudgetRemaining(total) {
        const budgetEl = document.getElementById('budgetRemaining');
        const totalBudgetSpan = document.getElementById('totalBudget');
        
        if (!budgetEl) return;
        
        // Récupérer le budget (depuis les paramètres du compte ou localStorage)
        let budget = 1000;
        if (this.currentBudget) {
            budget = this.currentBudget;
        } else if (localStorage.getItem('budget')) {
            budget = parseFloat(localStorage.getItem('budget'));
        }
        
        // Mettre à jour l'affichage du budget total
        if (totalBudgetSpan) {
            totalBudgetSpan.textContent = budget;
        }
        
        const remaining = budget - total;
        budgetEl.textContent = remaining.toFixed(2) + ' €';
        
        // Changer la couleur selon le solde
        if (remaining < 0) {
            budgetEl.style.color = '#ef233c';
        } else if (remaining < 100) {
            budgetEl.style.color = '#ffb703';
        } else {
            budgetEl.style.color = '';
        }
        
        // Mettre à jour la barre de progression si elle existe
        const progressBar = document.querySelector('.budget-progress-bar');
        if (progressBar) {
            const percentageUsed = Math.min((total / budget) * 100, 100);
            progressBar.style.width = percentageUsed + '%';
            progressBar.style.backgroundColor = remaining < 0 ? '#ef233c' : 
                                            percentageUsed >= 90 ? '#ffb703' : '#4361ee';
        }
    }

    // Synchronisation manuelle avec Google Drive
    manualSync() {
        if (!this.driveSync) {
            this.showNotification('Google Drive non configuré', 'error');
            return;
        }
        
        if (!this.driveSync.isAuthenticated) {
            this.showNotification('Veuillez d\'abord vous connecter à Google Drive', 'warning');
            // Ouvrir le panneau Drive
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

    // Échapper les caractères HTML pour la sécurité
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Mettre à jour les statistiques
    updateStats(expenses) {
        if (!this.totalAmountEl || !this.expenseCountEl) return;
        
        const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        // Utiliser la devise du compte courant
        const currency = this.currentCurrency || localStorage.getItem('currency') || 'EUR';
        const symbol = this.getCurrencySymbol(currency);
        
        this.totalAmountEl.textContent = total.toFixed(2) + ' ' + symbol;
        this.expenseCountEl.textContent = expenses.length;
        
        // ✅ Mettre à jour l'affichage du budget (avec async)
        this.updateBudgetRemaining(total);
    }
    
    // Afficher une notification
    showNotification(message, type = 'success') {
        // Supprimer les anciennes notifications
        const oldNotifications = document.querySelectorAll('.notification');
        const getmessage = window.lang.getText(message);
        oldNotifications.forEach(n => n.remove());

        // Couleurs selon le type
        const colors = {
            success: '#4cc9f0',
            error: '#f72585',
            info: '#4361ee',
            warning: '#f8961e'
        };

        // Icônes selon le type
        const icons = {
            success: 'check_circle',
            error: 'error',
            info: 'info',
            warning: 'warning'
        };

        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="material-icons">${icons[type] || 'info'}</span>
            <span>${getmessage}</span>
        `;

        // Ajouter les styles de notification
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

        // Supprimer la notification après 3 secondes
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // À AJOUTER dans la classe ExpenseApp, après les autres méthodes

    // Initialiser les filtres chips
    initFilterChips() {
        this.filterChips = document.querySelectorAll('.filter-chip');
        this.activeFilter = 'all'; // Filtre par défaut
        
        this.filterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.applyFilterChip(filter);
            });
        });
    }

    // Initialiser l'autocomplétion
    initAutocomplete() {
        // Attendre que le DOM soit prêt et que la base soit chargée
        setTimeout(() => {
            const expenseNameInput = document.getElementById('expenseName');
            if (expenseNameInput && !window.autocomplete) {
                // Vérifier que la classe ExpenseAutocomplete existe
                if (typeof ExpenseAutocomplete !== 'undefined') {
                    window.autocomplete = new ExpenseAutocomplete(expenseNameInput);
                    console.log('✅ Autocomplétion initialisée');
                } else {
                    console.warn('⚠️ Classe ExpenseAutocomplete non trouvée');
                }
            }
        }, 1000); // Petit délai pour laisser le temps à la DB de se charger
    }

    // Mettre à jour l'autocomplétion après ajout d'une dépense
    updateAutocomplete() {
        if (window.autocomplete) {
            window.autocomplete.loadExpenses();
        }
    }

    // Appliquer le filtre sélectionné
    // Appliquer le filtre sélectionné
    applyFilterChip(filter) {
        // Mettre à jour la classe active
        this.filterChips.forEach(chip => {
            if (chip.dataset.filter === filter) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
        
        this.activeFilter = filter;
        
        // Appliquer le filtre aux dépenses
        this.loadExpenses(); // ← Mettra à jour le résumé automatiquement
    }

    // Surcharger la méthode filterExpenses pour inclure les chips
    filterExpenses(expenses) {
        // Appliquer d'abord les filtres texte (nom, date, mois)
        let filtered = expenses.filter(expense => {
            let match = true;
            
            // Filtre par nom
            if (this.currentFilters.name && this.currentFilters.name.trim() !== '') {
                match = match && expense.name.toLowerCase().includes(this.currentFilters.name.toLowerCase());
            }
            
            // Filtre par date exacte
            if (this.currentFilters.date && this.currentFilters.date.trim() !== '') {
                const expenseDate = new Date(expense.date).toISOString().split('T')[0];
                match = match && expenseDate === this.currentFilters.date;
            }
            
            // Filtre par mois
            if (this.currentFilters.month && this.currentFilters.month.trim() !== '') {
                const expenseMonth = new Date(expense.date).toISOString().substring(0, 7);
                match = match && expenseMonth === this.currentFilters.month;
            }
            
            return match;
        });
        
        // Puis appliquer le filtre par chips (période)
        filtered = this.applyPeriodFilter(filtered, this.activeFilter);
        
        return filtered;
    }

    // Appliquer le filtre par période
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
                weekStart.setDate(today.getDate() - today.getDay()); // Dimanche = début de semaine
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
                
            case 'all':
            default:
                return expenses;
        }
    }
    
}

// ============================================
// INITIALISATION CORRECTE
// ============================================

// Ajouter un bouton de synchronisation manuelle dans l'en-tête
function addManualSyncButton() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    
    // Vérifier si le bouton existe déjà
    if (document.getElementById('manualSyncBtn')) return;
    
    const syncBtn = document.createElement('button');
    syncBtn.className = 'btn-icon';
    syncBtn.id = 'manualSyncBtn';
    syncBtn.innerHTML = '<span class="material-icons">sync</span>';
    syncBtn.title = 'Synchroniser maintenant';
    syncBtn.onclick = () => {
        if (window.app) {
            window.app.manualSync();
        }
    };
    
    // Ajouter avant le bouton Drive
    const driveBtn = document.getElementById('googleDriveBtn');
    if (driveBtn) {
        headerActions.insertBefore(syncBtn, driveBtn);
    } else {
        headerActions.appendChild(syncBtn);
    }
}

// Ajouter les styles pour l'icône pending
const style = document.createElement('style');
style.textContent = `
    .pending-icon {
        font-size: 14px;
        margin-left: 5px;
        color: #f8961e;
    }
    
    .expense-card.pending {
        border-left: 4px solid #f8961e;
        background: linear-gradient(45deg, #fff, #fff3cd);
    }
`;
document.head.appendChild(style);

// À ajouter à la fin de app.js, après l'initialisation de l'application

// Gestion du menu mobile
class MobileMenu {
    constructor() {
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebar = document.querySelector('.sidebar');
        this.overlay = null;
        
        this.init();
    }

    init() {
        if (this.menuToggle && this.sidebar) {
            this.menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMenu();
            });
            
            this.createOverlay();
            
            if (this.overlay) {
                this.overlay.addEventListener('click', () => {
                    this.closeMenu();
                });
            }
            
            // Gérer le redimensionnement de la fenêtre
            window.addEventListener('resize', () => {
                this.handleResize();
            });
            
            // Empêcher la fermeture quand on clique dans le sidebar
            this.sidebar.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }
    
    handleResize() {
        if (window.innerWidth > 992) {
            // Mode desktop : forcer l'affichage du menu
            this.sidebar.classList.remove('active');
            this.sidebar.style.transform = '';
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
            document.body.classList.remove('menu-open');
        }
        // Ne rien faire sur mobile, laisser le menu tel quel
    }
    
    createOverlay() {
        if (!document.querySelector('.sidebar-overlay')) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'sidebar-overlay';
            document.body.appendChild(this.overlay);
        } else {
            this.overlay = document.querySelector('.sidebar-overlay');
        }
    }
    
    toggleMenu() {
        if (this.sidebar.classList.contains('active')) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        this.sidebar.classList.add('active');
        if (this.overlay) {
            this.overlay.classList.add('active');
        }
        // document.body.style.overflow = 'hidden';
        document.body.classList.add('menu-open');
    }
    
    closeMenu() {
        this.sidebar.classList.remove('active');
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
        // document.body.style.overflow = '';
        document.body.classList.remove('menu-open');
    }
}

// ============================================
// GESTION SIMPLE DE LA NAVIGATION
// ============================================

class NavigationManager {
    constructor() {
        // Récupérer tous les éléments du menu
        this.navItems = document.querySelectorAll('.nav-item');
        this.sidebar = document.querySelector('.sidebar');
        this.overlay = document.querySelector('.sidebar-overlay');
        
        // Initialiser
        this.init();
    }
    
    init() {
        // Ajouter l'événement click sur chaque bouton du menu
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Récupérer le texte du bouton cliqué
                const buttonText = item.querySelector('span:last-child').textContent.trim();
                console.log('Clic sur:', buttonText);
                
                // Mettre à jour la classe active
                this.setActiveItem(item);
                
                // Afficher la section correspondante
                this.showSection(buttonText);
                
                // Fermer le menu mobile
                this.closeMobileMenu();

                // Dans initSettingsEvents(), ajoute :
                const languageRadios = document.querySelectorAll('input[name="language"]');
                languageRadios.forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            const lang = e.target.value;
                            window.lang.setLanguage(lang);
                            this.updateUILanguage();
                        }
                    });
                });
            });
        });
        
        console.log('Navigation prête !');
    }
    
    
    setActiveItem(clickedItem) {
        // Enlever la classe active de tous les boutons
        this.navItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // Ajouter la classe active au bouton cliqué
        clickedItem.classList.add('active');
    }
    
    showSection(sectionName) {
        // Masquer toutes les sections spéciales si elles existent
        this.hideAllSpecialSections();
        
        // Afficher la section appropriée
        switch(sectionName) {
            case 'Tableau de bord':
                const appBody = document.getElementById('appBody');
                appBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
                this.showDashboard();
                break;
                
            case 'Dépenses':
                this.showAllExpenses();
                break;
                
            case 'Statistiques':
                this.showStatistics();
                break;
                
            case 'Paramètres':
                this.showSettings();
                break;
                
            default:
                this.showDashboard();
        }
    }
    
    hideAllSpecialSections() {
        // Cacher les sections supplémentaires si elles existent
        const statsSection = document.querySelector('.statistics-section');
        const settingsSection = document.querySelector('.settings-section');
        const expensesSection = document.querySelector('.expenses-section');
        const dashboardSection = document.querySelectorAll('.dashboard-section');
        dashboardSection.forEach(section => {
            if (section) section.style.display = 'none';
        });

        
        if (statsSection) statsSection.style.display = 'none';
        if (settingsSection) settingsSection.style.display = 'none';
        
        
        // Réafficher la section des dépenses par défaut
        if (expensesSection) expensesSection.style.display = 'block';
    }
    
    showDashboard() {
        console.log('Dashboard affiché');
        
        const dashboardSection = document.querySelectorAll('.dashboard-section');
        dashboardSection.forEach(section => {
            if (section) section.style.display = 'grid';
        });

        // Réinitialiser le titre des dépenses
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<span class="material-icons">receipt_long</span> Dépenses récentes';
        }
        
        // Recharger les dépenses (seulement les récentes)
        if (window.app) {
            window.app.loadExpenses();
        }
    }
    
    showAllExpenses() {
        console.log('Toutes les dépenses');
        
        // Changer le titre
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<span class="material-icons">receipt</span> Toutes les dépenses';
        }
        
        // Charger TOUTES les dépenses
        if (window.app && window.app.db) {
            window.app.db.getAllExpenses().then(expenses => {
                window.app.displayExpenses(expenses);
            });
        }
    }
    
    showStatistics() {
        console.log('Statistiques');
        
        // Vérifier si la section statistiques existe
        let statsSection = document.querySelector('.statistics-section');
        const currency = localStorage.getItem('currency') || 'XOF';

        if (!statsSection) {
            // Créer la section
            statsSection = document.createElement('div');
            statsSection.className = 'statistics-section';
            statsSection.innerHTML = `
                <div class="section-header">
                    <h2>
                        <span class="material-icons">pie_chart</span>
                        Statistiques
                    </h2>
                </div>
                <div class="stats-placeholder">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <span class="material-icons">show_chart</span>
                        </div>
                        <div class="stat-details">
                            <span class="stat-label">Total</span>
                            <span class="stat-value" id="statsTotal">0 ${currency}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <span class="material-icons">date_range</span>
                        </div>
                        <div class="stat-details">
                            <span class="stat-label">Ce mois</span>
                            <span class="stat-value" id="statsMonth">0 ${currency}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <span class="material-icons">trending_up</span>
                        </div>
                        <div class="stat-details">
                            <span class="stat-label">Moyenne</span>
                            <span class="stat-value" id="statsAverage">0 ${currency}</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Ajouter après la section des dépenses
            const expensesSection = document.querySelector('.expenses-section');
            if (expensesSection) {
                expensesSection.parentNode.insertBefore(statsSection, expensesSection.nextSibling);
            }
        }
        
        // Cacher la section des dépenses
        document.querySelector('.expenses-section').style.display = 'none';
        
        // Afficher la section statistiques
        statsSection.style.display = 'block';
        
        // Charger les statistiques
        this.loadStatistics();
    }
    
    showSettings() {
        console.log('Affichage des paramètres');
        
        // Vérifier si la section paramètres existe
        let settingsSection = document.querySelector('.settings-section');
        
        if (!settingsSection) {
            // Créer la section avec les options de devise et stockage
            let currency = localStorage.getItem('currency') || 'XOF';
            settingsSection = document.createElement('div');
            settingsSection.className = 'settings-section';
            settingsSection.innerHTML = `
                <div class="section-header">
                    <h2>
                        <span class="material-icons">settings</span>
                        <span data-i18n="settings">Paramètres</span>
                    </h2>
                </div>
                
                <!-- Carte: Choix de la monnaie -->
                <div class="settings-card">
                    <h3>
                        <span class="material-icons">attach_money</span>
                        <span data-i18n="currency">Monnaie (Dévise)</span>
                    </h3>
                    <div class="currency-selector">
                        <select id="currencySelect" class="currency-select">
                            <option value="EUR" ${localStorage.getItem('currency') === 'EUR' ? 'selected' : ''}>Euro (€) - EUR</option>
                            <option value="USD" ${localStorage.getItem('currency') === 'USD' ? 'selected' : ''}>Dollar ($) - USD</option>
                            <option value="GBP" ${localStorage.getItem('currency') === 'GBP' ? 'selected' : ''}>Livre sterling (£) - GBP</option>
                            <option value="CHF" ${localStorage.getItem('currency') === 'CHF' ? 'selected' : ''}>Franc suisse (CHF) - CHF</option>
                            <option value="CAD" ${localStorage.getItem('currency') === 'CAD' ? 'selected' : ''}>Dollar canadien (CAD) - CAD</option>
                            <option value="JPY" ${localStorage.getItem('currency') === 'JPY' ? 'selected' : ''}>Yen japonais (¥) - JPY</option>
                            <option value="CNY" ${localStorage.getItem('currency') === 'CNY' ? 'selected' : ''}>Yuan chinois (¥) - CNY</option>
                            <option value="XOF" ${localStorage.getItem('currency') === 'XOF' ? 'selected' : ''}>Franc CFA (FCFA) - XOF</option>
                            <option value="XAF" ${localStorage.getItem('currency') === 'XAF' ? 'selected' : ''}>Franc CFA (FCFA) - XAF</option>
                            <option value="MAD" ${localStorage.getItem('currency') === 'MAD' ? 'selected' : ''}>Dirham marocain (MAD) - MAD</option>
                            <option value="DZD" ${localStorage.getItem('currency') === 'DZD' ? 'selected' : ''}>Dinar algérien (DZD) - DZD</option>
                            <option value="TND" ${localStorage.getItem('currency') === 'TND' ? 'selected' : ''}>Dinar tunisien (TND) - TND</option>
                            <option value="NGN" ${localStorage.getItem('currency') === 'NGN' ? 'selected' : ''}>Naira nigérian (₦) - NGN</option>
                            <option value="ZAR" ${localStorage.getItem('currency') === 'ZAR' ? 'selected' : ''}>Rand sud-africain (ZAR) - ZAR</option>
                            <option value="BRL" ${localStorage.getItem('currency') === 'BRL' ? 'selected' : ''}>Real brésilien (BRL) - BRL</option>
                            <option value="RUB" ${localStorage.getItem('currency') === 'RUB' ? 'selected' : ''}>Rouble russe (RUB) - RUB</option>
                            <option value="INR" ${localStorage.getItem('currency') === 'INR' ? 'selected' : ''}>Roupie indienne (₹) - INR</option>
                            <option value="AUD" ${localStorage.getItem('currency') === 'AUD' ? 'selected' : ''}>Dollar australien (AUD) - AUD</option>
                        </select>
                        
                        <div class="currency-preview">
                            <span class="preview-label" data-i18n="preview">Aperçu:</span>
                            <span class="preview-value" id="currencyPreview">1 234,56 ${this.getCurrencySymbol(localStorage.getItem('currency') || 'XOF')}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Carte: Format d'affichage -->
                <div class="settings-card">
                    <h3>
                        <span class="material-icons">format_list_bulleted</span>
                        <span data-i18n="displayFormat">Format d'affichage</span>
                    </h3>
                    <div class="format-options">
                        <label class="format-option">
                            <input type="radio" name="format" value="space" ${localStorage.getItem('format') !== 'comma' ? 'checked' : ''}>
                            <span class="material-icons">123</span>
                            <span>1 234,56 ${this.getCurrencySymbol(localStorage.getItem('currency') || 'XOF')}</span>
                            <small data-i18n="spaceFormat">(espace pour les milliers)</small>
                        </label>
                        
                        <label class="format-option">
                            <input type="radio" name="format" value="comma" ${localStorage.getItem('format') === 'comma' ? 'checked' : ''}>
                            <span class="material-icons">123</span>
                            <span>1,234.56 ${this.getCurrencySymbol(localStorage.getItem('currency') || 'XOF')}</span>
                            <small data-i18n="commaFormat">(virgule pour les milliers)</small>
                        </label>
                        
                        <label class="format-option">
                            <input type="radio" name="format" value="none" ${localStorage.getItem('format') === 'none' ? 'checked' : ''}>
                            <span class="material-icons">123</span>
                            <span>1234.56 ${this.getCurrencySymbol(localStorage.getItem('currency') || 'XOF')}</span>
                            <small data-i18n="noFormat">(sans séparateur)</small>
                        </label>
                    </div>
                </div>

                <div class="settings-card">
                    <h3 data-i18n="monthlyBudget">Budget mensuel</h3>
                    <div class="setting-item">
                        <label data-i18n="maximumBudget">Budget maximum</label>
                        <input type="number" id="budgetInput" value="${localStorage.getItem('budget') || 0}" step="50">
                    </div>
                    <div class="setting-item">
                        <label data-i18n="exceedNotification">Notification de dépassement</label>
                        <label class="switch">
                            <input type="checkbox" id="budgetNotification" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                        
                <div class="settings-card">
                    <h3 data-i18n="appearance">Apparence</h3>
                    <div class="setting-item">
                        <label data-i18n="theme">Thème</label>
                        <select id="themeSelect">
                            <option value="light" ${localStorage.getItem('theme') === 'light' || !localStorage.getItem('theme') ? 'selected' : ''} data-i18n="light">Clair</option>
                            <option value="dark" ${localStorage.getItem('theme') === 'dark' ? 'selected' : ''} data-i18n="dark">Sombre</option>
                            <option value="auto" ${localStorage.getItem('theme') === 'auto' ? 'selected' : ''} data-i18n="auto">Auto</option>
                        </select>
                    </div>
                </div>
                
                <!-- Carte: Emplacement de stockage -->
                <div class="settings-card">
                    <h3>
                        <span class="material-icons">storage</span>
                        <span data-i18n="storageLocation">Emplacement de stockage</span>
                    </h3>
                    
                    <div class="storage-options">
                        <!-- Stockage local -->
                        <label class="storage-option ${localStorage.getItem('storageLocation') !== 'drive' ? 'selected' : ''}">
                            <input type="radio" name="storageLocation" value="local" ${localStorage.getItem('storageLocation') !== 'drive' ? 'checked' : ''}>
                            <span class="material-icons">phone_android</span>
                            <div class="storage-desc">
                                <span class="storage-title" data-i18n="localStorage">Stockage local</span>
                                <span class="storage-detail" data-i18n="localStorageDesc">Données sauvegardées uniquement sur cet appareil</span>
                            </div>
                        </label>
                        
                        <!-- Google Drive -->
                        <label class="storage-option ${localStorage.getItem('storageLocation') === 'drive' ? 'selected' : ''}">
                            <input type="radio" name="storageLocation" value="drive" ${localStorage.getItem('storageLocation') === 'drive' ? 'checked' : ''}>
                            <span class="material-icons">cloud</span>
                            <div class="storage-desc">
                                <span class="storage-title" data-i18n="googleDrive">Google Drive</span>
                                <span class="storage-detail" data-i18n="googleDriveDesc">Synchronisation cloud accessible partout</span>
                            </div>
                            ${localStorage.getItem('storageLocation') === 'drive' && !window.driveSync?.isAuthenticated ? 
                                '<span class="warning-badge" data-i18n="notConnected">Non connecté</span>' : ''}
                        </label>
                        
                        <!-- Stockage automatique -->
                        <label class="storage-option">
                            <input type="radio" name="storageLocation" value="auto">
                            <span class="material-icons">sync_alt</span>
                            <div class="storage-desc">
                                <span class="storage-title" data-i18n="autoMode">Mode automatique</span>
                                <span class="storage-detail" data-i18n="autoModeDesc">Local si hors ligne, Cloud si disponible</span>
                            </div>
                        </label>
                    </div>
                    
                    <div class="drive-status-card" id="driveStatusInSettings">
                        <!-- Statut Drive affiché dynamiquement -->
                    </div>
                </div>
                
                <!-- Carte: Langue -->
                <div class="settings-card">
                    <h3>
                        <span class="material-icons">language</span>
                        <span data-i18n="language">Langue / Language</span>
                    </h3>
                    <div class="language-selector">
                        <label class="language-option ${localStorage.getItem('language') === 'fr' ? 'selected' : ''}">
                            <input type="radio" name="language" value="fr" ${localStorage.getItem('language') !== 'en' ? 'checked' : ''}>
                            <span class="material-icons">flag</span>
                            <span class="lang-name">Français</span>
                            <span class="lang-native">Français</span>
                        </label>
                        
                        <label class="language-option ${localStorage.getItem('language') === 'en' ? 'selected' : ''}">
                            <input type="radio" name="language" value="en" ${localStorage.getItem('language') === 'en' ? 'checked' : ''}>
                            <span class="material-icons">flag</span>
                            <span class="lang-name">English</span>
                            <span class="lang-native">English</span>
                        </label>
                    </div>
                </div>                     

                <!-- Carte: Sauvegarde automatique -->
                <div class="settings-card">
                    <h3>
                        <span class="material-icons">backup</span>
                        <span data-i18n="autoBackup">Sauvegarde automatique</span>
                    </h3>
                    
                    <div class="auto-backup-options">
                        <label class="toggle-option">
                            <input type="checkbox" id="autoBackup" ${localStorage.getItem('autoBackup') !== 'false' ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            <span class="toggle-label" data-i18n="enableAutoBackup">Activer la sauvegarde automatique</span>
                        </label>
                        
                        <div class="backup-frequency" id="backupFrequencyGroup" style="display: ${localStorage.getItem('autoBackup') !== 'false' ? 'block' : 'none'}">
                            <label data-i18n="backupFrequency">Fréquence des sauvegardes</label>
                            <select id="backupFrequency">
                                <option value="1" ${localStorage.getItem('backupFrequency') === '1' ? 'selected' : ''} data-i18n="daily">Tous les jours</option>
                                <option value="7" ${localStorage.getItem('backupFrequency') === '7' ? 'selected' : ''} data-i18n="weekly">Toutes les semaines</option>
                                <option value="30" ${localStorage.getItem('backupFrequency') === '30' ? 'selected' : ''} data-i18n="monthly">Tous les mois</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Carte: Actions rapides -->
                <div class="settings-card">
                    <h3>
                        <span class="material-icons">bolt</span>
                        <span data-i18n="quickActions">Actions rapides</span>
                    </h3>
                    
                    <div class="quick-actions">
                        <button id="applySettingsBtn" class="btn-primary">
                            <span class="material-icons">check</span>
                            <span data-i18n="applySettings">Appliquer les paramètres</span>
                        </button>
                        
                        <button id="resetSettingsBtn" class="btn-secondary">
                            <span class="material-icons">restart_alt</span>
                            <span data-i18n="reset">Réinitialiser</span>
                        </button>
                    </div>
                </div>
            `;
                        
            // Ajouter après la section des dépenses
            const expensesSection = document.querySelector('.expenses-section');
            if (expensesSection) {
                expensesSection.parentNode.insertBefore(settingsSection, expensesSection.nextSibling);
            }
            
            // Initialiser les événements
            setTimeout(() => {
                this.initSettingsEvents();
                this.updateDriveStatus();
            }, 100);
        }
        
        // Cacher les autres sections
        const expensesSection = document.querySelector('.expenses-section');
        const statsSection = document.querySelector('.statistics-section');
        
        if (expensesSection) expensesSection.style.display = 'none';
        if (statsSection) statsSection.style.display = 'none';
        
        // Afficher la section paramètres
        settingsSection.style.display = 'block';
        
        // Mettre à jour le statut Drive
        this.updateDriveStatus();
    }

    // Méthode pour mettre à jour l'UI
    updateUILanguage() {
        // Mettre à jour tous les textes statiques
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = window.lang.getText(key);
        });
        
        // Mettre à jour les placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = window.lang.getText(key);
        });
        
        // Recharger les dépenses pour mettre à jour les dates
        if (window.app) {
            window.app.loadExpenses();
        }
}

    // Appliquer le thème
    applyTheme(theme) {
        // Sauvegarder
        localStorage.setItem('theme', theme);
        
        // Appliquer au body
        document.body.setAttribute('data-theme', theme);
        
        // Notification
        if (window.app) {
            window.app.showNotification(`Thème ${theme === 'light' ? 'clair' : theme === 'dark' ? 'sombre' : 'automatique'} activé`, 'info');
        }
        
        console.log('Thème appliqué:', theme);
    }

    // Obtenir le symbole de la monnaie
    getCurrencySymbol(currency) {
        const symbols = {
            'EUR': '€', 'USD': '$', 'GBP': '£', 'CHF': 'CHF', 'CAD': 'C$',
            'JPY': '¥', 'CNY': '¥', 'XOF': 'FCFA', 'XAF': 'FCFA', 'MAD': 'MAD',
            'DZD': 'DA', 'TND': 'DT', 'NGN': '₦', 'ZAR': 'R', 'BRL': 'R$',
            'RUB': '₽', 'INR': '₹', 'AUD': 'A$'
        };
        return symbols[currency] || 'XOF';
    }

    // Mettre à jour le statut Drive
    updateDriveStatus() {
        const driveStatus = document.getElementById('driveStatusInSettings');
        if (!driveStatus) return;
        
        if (window.driveSync && window.driveSync.isAuthenticated) {
            driveStatus.innerHTML = `
                <div class="drive-status connected">
                    <span class="material-icons">check_circle</span>
                    <span>Connecté à Google Drive</span>
                    <button id="disconnectDriveBtn" class="btn-small">Déconnecter</button>
                </div>
            `;
            
            document.getElementById('disconnectDriveBtn')?.addEventListener('click', () => {
                if (window.driveSync) {
                    window.driveSync.signOut();
                    this.updateDriveStatus();
                }
            });
        } else {
            driveStatus.innerHTML = `
                <div class="drive-status disconnected">
                    <span class="material-icons">cloud_off</span>
                    <span>Non connecté à Google Drive</span>
                    <button id="connectDriveBtn" class="btn-small">Se connecter</button>
                </div>
            `;
            
            document.getElementById('connectDriveBtn')?.addEventListener('click', () => {
                if (window.driveSync) {
                    window.driveSync.signIn();
                    setTimeout(() => this.updateDriveStatus(), 2000);
                }
            });
        }
    }

    // Initialiser les événements des paramètres (VERSION FUSIONNÉE)
    initSettingsEvents() {
        // ===== 1. MONNAIE =====
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.addEventListener('change', (e) => {
                const currency = e.target.value;
                localStorage.setItem('currency', currency);
                
                // Mettre à jour l'aperçu
                const preview = document.getElementById('currencyPreview');
                if (preview) {
                    preview.textContent = `1 234,56 ${this.getCurrencySymbol(currency)}`;
                }
            });
        }
        
        // ===== 2. FORMAT D'AFFICHAGE =====
        const formatRadios = document.querySelectorAll('input[name="format"]');
        formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    localStorage.setItem('format', e.target.value);
                }
            });
        });
        
        // ===== 3. EMPLACEMENT STOCKAGE =====
        const storageRadios = document.querySelectorAll('input[name="storageLocation"]');
        storageRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    localStorage.setItem('storageLocation', e.target.value);
                    
                    // Mettre à jour les classes selected
                    document.querySelectorAll('.storage-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    e.target.closest('.storage-option').classList.add('selected');
                    
                    // Afficher une notification
                    if (window.app) {
                        window.app.showNotification(`Stockage: ${e.target.value}`, 'info');
                    }
                }
            });
        });
        
        // ===== 4. BUDGET =====
        const budgetInput = document.getElementById('budgetInput');
        if (budgetInput) {
            budgetInput.addEventListener('change', (e) => {
                localStorage.setItem('budget', e.target.value);
                this.updateBudgetDisplay(e.target.value);
            });
        }
        
        // ===== 5. NOTIFICATION BUDGET =====
        const budgetNotification = document.getElementById('budgetNotification');
        if (budgetNotification) {
            budgetNotification.addEventListener('change', (e) => {
                localStorage.setItem('budgetNotification', e.target.checked);
            });
        }
        
        // ===== 6. THÈME =====
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            // Charger le thème sauvegardé
            const savedTheme = localStorage.getItem('theme') || 'light';
            themeSelect.value = savedTheme;
            document.body.setAttribute('data-theme', savedTheme);
            
            // Écouter les changements
            themeSelect.addEventListener('change', (e) => {
                const theme = e.target.value;
                this.applyTheme(theme);
            });
        }
        
        // ===== 7. URL SERVEUR =====
        const serverUrl = document.getElementById('serverUrl');
        if (serverUrl) {
            serverUrl.addEventListener('change', (e) => {
                localStorage.setItem('serverUrl', e.target.value);
                if (window.driveSync) {
                    window.driveSync.serverUrl = e.target.value;
                }
            });
        }
        
        // ===== 8. SYNCHRONISATION MANUELLE =====
        const syncBtn = document.getElementById('manualSync');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                if (window.app) {
                    window.app.manualSync();
                } else {
                    alert('Application non initialisée');
                }
            });
        }
        
        // ===== 9. SAUVEGARDE AUTOMATIQUE =====
        const autoBackup = document.getElementById('autoBackup');
        const backupFrequencyGroup = document.getElementById('backupFrequencyGroup');
        
        if (autoBackup) {
            autoBackup.addEventListener('change', (e) => {
                localStorage.setItem('autoBackup', e.target.checked);
                backupFrequencyGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        // ===== 10. FRÉQUENCE SAUVEGARDE =====
        const backupFrequency = document.getElementById('backupFrequency');
        if (backupFrequency) {
            backupFrequency.addEventListener('change', (e) => {
                localStorage.setItem('backupFrequency', e.target.value);
            });
        }
        
        
        // ===== 11. BOUTON APPLIQUER =====
        const applyBtn = document.getElementById('applySettingsBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                // Récupérer tous les paramètres
                const currency = document.getElementById('currencySelect')?.value || 'EUR';
                const format = document.querySelector('input[name="format"]:checked')?.value || 'space';
                const storage = document.querySelector('input[name="storageLocation"]:checked')?.value || 'local';
                const budget = document.getElementById('budgetInput')?.value || '1000';
                const theme = document.getElementById('themeSelect')?.value || 'light';
                const budgetNotification = document.getElementById('budgetNotification')?.checked || false;
                const autoBackup = document.getElementById('autoBackup')?.checked || false;
                const backupFreq = document.getElementById('backupFrequency')?.value || '7';
                // Dans le click du bouton "Appliquer"


                // Sauvegarder tous les paramètres
                localStorage.setItem('currency', currency);
                localStorage.setItem('format', format);
                localStorage.setItem('storageLocation', storage);
                localStorage.setItem('budget', budget);
                localStorage.setItem('theme', theme);
                localStorage.setItem('budgetNotification', budgetNotification);
                localStorage.setItem('autoBackup', autoBackup);
                localStorage.setItem('backupFrequency', backupFreq);
                
                        
                // ✅ Sauvegarder le budget dans le compte
                // Sauvegarder le budget dans le compte
                if (budget && window.app?.db) {
                    window.app.db.saveAccountSettings({ budget: parseFloat(budget) }).then(() => {
                        // Mettre à jour l'affichage après sauvegarde
                        if (window.app) {
                            window.app.db.getAllExpenses().then(expenses => {
                                const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                                window.app.updateBudgetRemaining(total);
                            });
                        }
                    });
                }

                // Appliquer le thème
                document.body.setAttribute('data-theme', theme);
                this.applyTheme(theme);  // ← Important !
                // Appliquer la monnaie à l'affichage
                this.applyCurrencyToDisplay(currency);
                
                // Recharger les dépenses pour voir les changements
                if (window.app) {
                    window.app.loadExpenses();
                    window.app.showNotification('Paramètres appliqués avec succès !', 'success');
                }
                
                window.location.reload(); // Recharger la page pour appliquer tous les changements (optionnel, à tester pour voir si nécessaire)
            });
        }
        
        // ===== 12. BOUTON RÉINITIALISER =====
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Réinitialiser tous les paramètres ?')) {
                    localStorage.clear();
                    window.location.reload();
                }
            });
        }
    }

    // Appliquer la monnaie à l'affichage
    applyCurrencyToDisplay(currency) {
        const symbol = this.getCurrencySymbol(currency);
        
        // Mettre à jour les éléments qui affichent des montants
        document.querySelectorAll('.expense-amount, .stat-value').forEach(el => {
            if (el.id !== 'expenseCount') {
                const text = el.textContent;
                const number = text.replace(/[^\d,.-]/g, '');
                if (number) {
                    el.textContent = number + ' ' + symbol;
                }
            }
        });
    }

    // Appliquer le format à l'affichage
    applyFormatToDisplay(format) {
        // Sera utilisé lors du formatage des nombres
        console.log('Format appliqué:', format);
    }

    loadSavedSettings() {
        // Budget
        const savedBudget = localStorage.getItem('budget');
        if (savedBudget) {
            const budgetInput = document.getElementById('budgetInput');
            if (budgetInput) budgetInput.value = savedBudget;
            this.updateBudgetDisplay(savedBudget);
        }
        
        // URL serveur
        const savedUrl = localStorage.getItem('serverUrl');
        if (savedUrl) {
            const urlInput = document.getElementById('serverUrl');
            if (urlInput) urlInput.value = savedUrl;
            if (window.syncManager) window.syncManager.serverUrl = savedUrl;
        }
    }
    
    updateBudgetDisplay(budget) {
        const budgetEl = document.getElementById('budgetRemaining');
        if (budgetEl) {
            budgetEl.textContent = budget + ' ' + this.getCurrencySymbol(localStorage.getItem('currency') || 'XOF');
        }
    }
    
    async loadStatistics() {
        if (!window.app || !window.app.db) return;
        
        const expenses = await window.app.db.getAllExpenses();
        
        // Calculer les statistiques
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);
        const avg = expenses.length > 0 ? total / expenses.length : 0;
        
        // Dépenses du mois
        const now = new Date();
        const monthExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        // Mettre à jour l'affichage
        const statsTotal = document.getElementById('statsTotal');
        const statsMonth = document.getElementById('statsMonth');
        const statsAverage = document.getElementById('statsAverage');
        const currency = this.getCurrencySymbol(localStorage.getItem('currency') || 'XOF');
        
        if (statsTotal) statsTotal.textContent = total.toFixed(2) + ' ' + currency;
        if (statsMonth) statsMonth.textContent = monthTotal.toFixed(2) + ' ' + currency;
        if (statsAverage) statsAverage.textContent = avg.toFixed(2) + ' ' + currency;
    }
    
    closeMobileMenu() {
        // Ne fermer le menu que si on est sur mobile
        if (window.innerWidth <= 992) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            
            if (sidebar) {
                sidebar.classList.remove('active');
                sidebar.style.transform = ''; // Laisser le CSS gérer
            }
            if (overlay) {
                overlay.classList.remove('active');
            }
            document.body.classList.remove('menu-open');
        }
    }
}

// ============================================
// CSS POUR LES NOUVELLES SECTIONS
// ============================================

function addSectionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .statistics-section,
        .settings-section {
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
// SYSTÈME DE NOTIFICATIONS
// ============================================

// ============================================
// SYSTÈME DE NOTIFICATIONS - VERSION CORRIGÉE
// ============================================

class NotificationSystem {
    constructor() {
        this.budget = parseFloat(localStorage.getItem('budget')) || 1000;
        this.notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
        this.reminderTime = localStorage.getItem('reminderTime') || '20:00';
        this.lastNotificationDate = localStorage.getItem('lastNotificationDate') || null;
        
        // Attendre que la DB soit prête
        this.waitForDB();
    }
    
    waitForDB() {
        if (window.app && window.app.db && window.app.db.db) {
            this.init();
        } else {
            console.log('⏳ Attente de la base de données...');
            setTimeout(() => this.waitForDB(), 200);
        }
    }
    
    init() {
        console.log('📊 Initialisation du système de notifications');
        this.requestPermission();
        this.checkBudget();
        this.scheduleDailyReminder();
        
        setInterval(() => {
            this.checkBudget();
        }, 60 * 60 * 1000);
    }
    
    // ============================================
    // GESTION DES PERMISSIONS
    // ============================================
    
    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('Ce navigateur ne supporte pas les notifications');
            return;
        }
        
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('Permission notification:', permission);
        }
    }
    
    // ============================================
    // AFFICHAGE DES NOTIFICATIONS
    // ============================================
    
    async showNotification(title, options = {}) {
        if (!('Notification' in window)) return false;
        
        if (!this.notificationsEnabled) return false;
        
        if (Notification.permission !== 'granted') {
            console.log('Permission non accordée');
            return false;
        }
        
        const defaultOptions = {
            icon: '/icons/image.png',
            badge: '/icons/image.png',
            silent: false,
            vibrate: [200, 100, 200],
            requireInteraction: true
        };
        
        try {
            const notification = new Notification(title, { ...defaultOptions, ...options });
            
            notification.onclick = function() {
                window.focus();
                this.close();
            };
            
            return notification;
        } catch (error) {
            console.error('Erreur notification:', error);
            return false;
        }
    }
    
    // ============================================
    // VÉRIFICATION DU BUDGET
    // ============================================
    
    async checkBudget() {
        if (!window.app || !window.app.db) return;
        
        try {
            const expenses = await window.app.db.getAllExpenses();
            
            const now = new Date();
            const monthExpenses = expenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            
            const monthTotal = monthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const remaining = this.budget - monthTotal;
            const percentageUsed = (monthTotal / this.budget) * 100;
            
            this.updateBudgetDisplay(remaining, percentageUsed);
            
            if (remaining < 0) {
                this.showNotification('⚠️ Budget dépassé !', {
                    body: `Vous avez dépassé votre budget de ${Math.abs(remaining).toFixed(2)} €.`,
                    tag: 'budget-over'
                });
            } else if (percentageUsed >= 90 && percentageUsed < 100) {
                this.showNotification('⚠️ Budget presque épuisé', {
                    body: `Vous avez utilisé ${percentageUsed.toFixed(0)}% de votre budget. Il reste ${remaining.toFixed(2)} €.`,
                    tag: 'budget-warning'
                });
            } else if (percentageUsed >= 75 && percentageUsed < 90) {
                this.showNotification('💰 Attention à votre budget', {
                    body: `Vous avez utilisé ${percentageUsed.toFixed(0)}% de votre budget.`,
                    tag: 'budget-notice'
                });
            }
            
        } catch (error) {
            console.error('Erreur vérification budget:', error);
        }
    }
    
    updateBudgetDisplay(remaining, percentageUsed) {
        const budgetEl = document.getElementById('budgetRemaining');
        if (budgetEl) {

            let currencie = localStorage.getItem('currency') || 'XOF';
            budgetEl.textContent = remaining.toFixed(2) + ' ' + currencie;
            
            if (remaining < 0) {
                budgetEl.style.color = '#ef233c';
            } else if (percentageUsed >= 90) {
                budgetEl.style.color = '#ffb703';
            } else {
                budgetEl.style.color = '';
            }
        }
        
        const progressBar = document.querySelector('.budget-progress-bar');
        if (progressBar) {
            progressBar.style.width = Math.min(percentageUsed, 100) + '%';
            progressBar.style.backgroundColor = remaining < 0 ? '#ef233c' : 
                                               percentageUsed >= 90 ? '#ffb703' : '#4361ee';
        }
    }
    
    // ============================================
    // RAPPELS QUOTIDIENS
    // ============================================
    
    scheduleDailyReminder() {
        setInterval(() => {
            this.checkDailyReminder();
        }, 60 * 1000);
    }
    
    checkDailyReminder() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (currentTime !== this.reminderTime) return;
        
        const today = now.toDateString();
        if (this.lastNotificationDate === today) return;
        
        this.checkTodayExpenses().then(hasExpenses => {
            if (!hasExpenses) {
                this.showNotification('📝 Rappel quotidien', {
                    body: 'Vous n\'avez pas encore enregistré de dépenses aujourd\'hui. Pensez à les noter !',
                    tag: 'daily-reminder'
                });
                
                this.lastNotificationDate = today;
                localStorage.setItem('lastNotificationDate', today);
            }
        });
    }
    
    async checkTodayExpenses() {
        if (!window.app || !window.app.db) return false;
        
        try {
            const expenses = await window.app.db.getAllExpenses();
            const today = new Date().toDateString();
            
            return expenses.some(e => {
                const expenseDate = new Date(e.date).toDateString();
                return expenseDate === today;
            });
        } catch (error) {
            console.error('Erreur vérification dépenses du jour:', error);
            return false;
        }
    }
    
    // ============================================
    // MISE À JOUR DES PARAMÈTRES
    // ============================================
    
    updateSettings(budget, enabled, time) {
        this.budget = budget;
        this.notificationsEnabled = enabled;
        this.reminderTime = time;
        
        localStorage.setItem('budget', budget);
        localStorage.setItem('notificationsEnabled', enabled);
        localStorage.setItem('reminderTime', time);
        
        this.checkBudget();
    }
}
// ============================================
// BOUTON DE NOTIFICATION DANS L'EN-TÊTE
// ============================================

function addNotificationButton() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    
    // Créer le bouton de notification avec indicateur
    const notifBtn = document.createElement('button');
    notifBtn.className = 'btn-icon notification-btn';
    notifBtn.id = 'notificationBtn';
    notifBtn.innerHTML = `
        <span class="material-icons">notifications</span>
        <span class="notification-badge" id="notificationBadge" style="display: none;">●</span>
    `;
    
    // Insérer avant le bouton compte
    const accountBtn = headerActions.querySelector('.btn-icon:last-child');
    if (accountBtn) {
        headerActions.insertBefore(notifBtn, accountBtn);
    } else {
        headerActions.appendChild(notifBtn);
    }
    
    // Ajouter le panneau de notifications
    addNotificationPanel();
}

function addNotificationPanel() {
    const panel = document.createElement('div');
    const currency = localStorage.getItem('currency') || 'EUR';
    panel.className = 'notification-panel';
    panel.id = 'notificationPanel';
    panel.innerHTML = `
        <div class="notification-header">
            <h3>Notifications</h3>
            <span class="material-icons close-panel">close</span>
        </div>
        <div class="notification-settings">
            <div class="setting-item">
                <label>Budget mensuel (${currency})</label>
                <input type="number" id="panelBudget" class="settings-input" value="${localStorage.getItem('budget') || 1000}">
            </div>
            <div class="setting-item">
                <label>
                    <input type="checkbox" id="panelNotifications" ${localStorage.getItem('notificationsEnabled') !== 'false' ? 'checked' : ''}>
                    Activer les notifications
                </label>
            </div>
            <div class="setting-item">
                <label>Heure du rappel</label>
                <input type="time" id="panelReminderTime" value="${localStorage.getItem('reminderTime') || '20:00'}">
            </div>
            <button id="saveNotifSettings" class="btn-add" style="width:100%;">
                <span class="material-icons">save</span>
                Enregistrer
            </button>
        </div>
        <div class="notification-list">
            <div class="notification-item info">
                <span class="material-icons">info</span>
                <div class="notif-content">
                    <div class="notif-title">Bienvenue !</div>
                    <div class="notif-message">Configurez vos notifications pour ne rien oublier.</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Gérer l'ouverture/fermeture
    const notifBtn = document.getElementById('notificationBtn');
    const closeBtn = panel.querySelector('.close-panel');
    
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
    });
    
    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
    });
    
    // Fermer en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !notifBtn.contains(e.target)) {
            panel.classList.remove('active');
        }
    });
    
    // Gérer la sauvegarde
    const saveBtn = document.getElementById('saveNotifSettings');
    saveBtn.addEventListener('click', () => {
        const budget = parseFloat(document.getElementById('panelBudget').value) || 1000;
        const enabled = document.getElementById('panelNotifications').checked;
        const time = document.getElementById('panelReminderTime').value;
        
        if (window.notificationSystem) {
            window.notificationSystem.updateSettings(budget, enabled, time);
            
            // Mettre à jour l'affichage
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.style.display = enabled ? 'block' : 'none';
            }
            
            // Notification de confirmation
            window.notificationSystem.showNotification('Paramètres sauvegardés', {
                body: 'Vos préférences ont été enregistrées.',
                tag: 'settings-saved'
            });
        }
    });
    
    // Ajouter les styles
    addNotificationStyles();
}

function addNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .notification-btn {
            position: relative;
        }
        
        .notification-badge {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 8px;
            height: 8px;
            background: #ef233c;
            border-radius: 50%;
            color: transparent;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .notification-panel {
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
        
        .notification-panel.active {
            display: block;
        }
        
        .notification-header {
            padding: 16px 20px;
            border-bottom: 2px solid #edf2f4;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .notification-header h3 {
            font-size: 16px;
            color: #2b2d42;
        }
        
        .close-panel {
            cursor: pointer;
            color: #8d99ae;
        }
        
        .close-panel:hover {
            color: #2b2d42;
        }
        
        .notification-settings {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 2px solid #edf2f4;
        }
        
        .notification-list {
            padding: 20px;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .notification-item {
            display: flex;
            gap: 12px;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            background: #f8f9fa;
            animation: fadeIn 0.3s ease;
        }
        
        .notification-item.info {
            border-left: 3px solid #4361ee;
        }
        
        .notification-item.warning {
            border-left: 3px solid #ffb703;
        }
        
        .notification-item.success {
            border-left: 3px solid #06d6a0;
        }
        
        .notification-item.danger {
            border-left: 3px solid #ef233c;
        }
        
        .notif-content {
            flex: 1;
        }
        
        .notif-title {
            font-weight: 600;
            font-size: 14px;
            color: #2b2d42;
            margin-bottom: 4px;
        }
        
        .notif-message {
            font-size: 13px;
            color: #8d99ae;
        }
        
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    
    document.head.appendChild(style);
}


// ============================================
// INITIALISATION UNIQUE DE L'APPLICATION
// ============================================
// ============================================
// INITIALISATION UNIQUE DE L'APPLICATION
// ============================================

// ============================================
// INITIALISATION UNIQUE DE L'APPLICATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation de l\'application...');
    
    try {
        // 1. AJOUTER LES STYLES
        addSectionStyles();
        
        // 2. CRÉER LA BASE DE DONNÉES
        const db = new ExpenseDatabase();
        
        // 3. CRÉER GOOGLE DRIVE SYNC
        const driveSync = new GoogleDriveSync(db);
        
        // 4. CRÉER L'APPLICATION PRINCIPALE
        const app = new ExpenseApp(db, driveSync);
        
        // 5. EXPOSER GLOBALEMENT
        window.app = app;
        window.driveSync = driveSync;
        
        // 6. INITIALISER LA NAVIGATION
        setTimeout(() => {
            window.navigation = new NavigationManager();
        }, 200);
        
        // 7. INITIALISER LE MENU MOBILE
        new MobileMenu();
        
        // 8. AJOUTER LES BOUTONS (Drive, Sync manuelle, Notifications)
        setTimeout(() => {
            if (typeof addGoogleDriveButton === 'function') addGoogleDriveButton();
            if (typeof addManualSyncButton === 'function') addManualSyncButton();
            if (typeof addNotificationButton === 'function') addNotificationButton();
        }, 500);

        // ✅ AJOUTEZ CES LIGNES après window.app = app;
        setTimeout(() => {
            if (window.app && window.app.db) {
                window.accountManager = new AccountManager(window.app.db);
            }
        }, 1500);
        
        // 9. INITIALISER LES NOTIFICATIONS APRÈS QUE LA DB SOIT PRÊTE
        setTimeout(() => {
            // Attendre que la base soit initialisée
            const checkDBReady = setInterval(() => {
                if (db.db) {  // Vérifier que la base est ouverte
                    clearInterval(checkDBReady);
                    
                    window.notificationSystem = new NotificationSystem();
                    console.log('✅ Système de notifications initialisé');
                    
                    // Notification de bienvenue
                    setTimeout(() => {
                        if (window.notificationSystem?.notificationsEnabled) {
                            window.notificationSystem.showNotification('👋 Bienvenue !', {
                                body: 'N\'oubliez pas d\'enregistrer vos dépenses chaque jour.',
                                tag: 'welcome'
                            });
                        }
                    }, 2000);
                }
            }, 100);
        }, 1000);
        
        // 10. GÉRER LE BOUTON DONATE
        const donateBtn = document.getElementById('btn-donate');
        if (donateBtn) {
            donateBtn.addEventListener('click', () => {
                const phoneNumber = '2290166344554';
                const message = 'Bonjour, je souhaiterais effectuer un don. Quel est votre moyen de paiement ?';
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            });
        }

        console.log('✅ Application initialisée avec succès');

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    }
});

// ============================================
// SERVICE WORKER (PWA) - UNE SEULE DÉCLARATION
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('✅ Service Worker enregistré avec succès');
                
                // Vérifier les mises à jour
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Nouvelle version du Service Worker détectée');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('❌ Erreur Service Worker:', error);
            });
        
        // Écouter les messages du Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'BACKGROUND_SYNC' && window.app) {
                window.app.manualSync();
            }
        });
    });
}

// ============================================
// NOTIFICATION DE MISE À JOUR
// ============================================

function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <span class="material-icons">system_update</span>
            <span>Nouvelle version disponible</span>
            <button onclick="updateApp()" class="btn-update">Mettre à jour</button>
        </div>
    `;
    document.body.appendChild(notification);
}

window.updateApp = function() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    }
};

// ============================================
// GESTION DE L'INSTALLATION PWA
// ============================================

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
    
    document.getElementById('laterBtn').addEventListener('click', () => {
        prompt.remove();
    });
}

window.addEventListener('appinstalled', () => {
    console.log('✅ Application installée');
    document.getElementById('installPrompt')?.remove();
});

// ============================================
// STYLES UNIFIÉS
// ============================================

const styles = document.createElement('style');
styles.textContent = `
    /* Styles pour l'installation */
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
    
    .install-btn.primary:hover {
        background: #3f37c9;
        transform: translateY(-2px);
    }
    
    .install-btn.secondary {
        background: #f8f9fa;
        color: #2b2d42;
    }
    
    .install-btn.secondary:hover {
        background: #e9ecef;
    }
    
    /* Notification de mise à jour */
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
        transition: all 0.3s ease;
    }
    
    .btn-update:hover {
        background: #3f37c9;
        transform: translateY(-2px);
    }
    
    /* Animations */
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;

document.head.appendChild(styles);