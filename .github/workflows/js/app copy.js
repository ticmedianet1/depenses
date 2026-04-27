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

        // Définir la date et heure par défaut à maintenant
        if (this.expenseDateTime) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            this.expenseDateTime.value = now.toISOString().slice(0, 16);
        }
    }

    // Initialiser la base de données
    initDatabase() {
        this.db.init()
            .then(() => {
                console.log('Base de données initialisée');
                return this.loadExpenses();
            })
            .then(() => {
                // Plus besoin de startPeriodicSync, GoogleDriveSync le fait déjà
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
    }

    // Gérer la soumission du formulaire
    handleSubmit(e) {
        e.preventDefault();

        if (!this.expenseName.value || !this.expenseAmount.value || !this.expenseDateTime.value) {
            this.showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }

        const expense = {
            name: this.expenseName.value,
            amount: parseFloat(this.expenseAmount.value),
            date: new Date(this.expenseDateTime.value).toISOString(),
            synced: false  // Important pour le suivi
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
            .then(() => {
                // Déclencher la synchronisation Google Drive si connecté
                if (this.driveSync && this.driveSync.isAuthenticated && this.driveSync.isOnline) {
                    return this.driveSync.syncToDrive();
                }
            })
            .then(() => {
                return this.loadExpenses(); // Recharger après synchronisation
            })
            .catch(error => {
                this.showNotification('Erreur lors de l\'ajout de la dépense', 'error');
                console.error(error);
            });
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
        return this.db.filterExpenses(this.currentFilters)
            .then(expenses => {
                // Trier par date (plus récent d'abord)
                expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                this.displayExpenses(expenses);
                this.updateStats(expenses);
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
        const formattedDate = date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Vérifier si la dépense est synchronisée
        const pendingClass = !expense.synced ? 'pending' : '';
        const pendingIcon = !expense.synced ? '<span class="pending-icon" title="En attente de synchronisation">⏳</span>' : '';

        return `
            <div class="expense-card ${pendingClass}" data-id="${expense.id}">
                <div class="expense-header">
                    <div class="expense-name">
                        <span class="material-icons">shopping_cart</span>
                        ${this.escapeHtml(expense.name)}
                        ${pendingIcon}
                    </div>
                    <div class="expense-amount">
                        ${parseFloat(expense.amount).toFixed(2)} ${localStorage.getItem('currency') || 'XOF'}
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
        const currencySymbol = localStorage.getItem('currency') || 'XOF'; // Extraire le symbole monétaire
        this.totalAmountEl.textContent = total.toFixed(2) + ' '+currencySymbol;
        this.expenseCountEl.textContent = expenses.length;
        
        // Mettre à jour le budget restant si présent
        this.updateBudgetRemaining(total);
    }
    
    // Mettre à jour l'affichage du budget
    updateBudgetRemaining(total) {
        const budgetEl = document.getElementById('budgetRemaining');
        if (!budgetEl) return;
        
        const budgetText = budgetEl.textContent;
        const budgetMatch = budgetText.match(/[\d.]+/);
        if (budgetMatch) {
            const budget = parseFloat(budgetMatch[0]);
            const remaining = budget - total;
            const currencySymbol = localStorage.getItem('currency') || 'XOF'; // Extraire le symbole monétaire
            budgetEl.textContent = remaining.toFixed(2) + ' '+ currencySymbol; // Assurez-vous que currencySymbol est défini globalement ou ajustez selon votre code
            
            // Changer la couleur selon le solde
            if (remaining < 0) {
                budgetEl.style.color = '#ef233c';
            } else if (remaining < 100) {
                budgetEl.style.color = '#ffb703';
            } else {
                budgetEl.style.color = '';
            }
        }
    }

    // Afficher une notification
    showNotification(message, type = 'success') {
        // Supprimer les anciennes notifications
        const oldNotifications = document.querySelectorAll('.notification');
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
            <span>${message}</span>
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
}

// ============================================
// INITIALISATION CORRECTE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation de l\'application...');
    
    try {
        // 1. Créer la base de données
        const db = new ExpenseDatabase();
        
        // 2. Créer Google Drive Sync
        const driveSync = new GoogleDriveSync(db);
        
        // 3. Créer l'application avec les deux
        const app = new ExpenseApp(db, driveSync);
        
        // 4. Exposer globalement
        window.app = app;
        
        // 5. Ajouter le bouton Google Drive dans l'interface
        if (typeof addGoogleDriveButton === 'function') {
            addGoogleDriveButton();
        }
        
        // 6. Ajouter un bouton de synchronisation manuelle (optionnel)
        addManualSyncButton();
        
        console.log('✅ Application initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    }
});

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

const db = new ExpenseDatabase();
const driveSync = new GoogleDriveSync(db);
const app = new ExpenseApp(db, driveSync);

// À ajouter à la fin de app.js, après l'initialisation de l'application

// Gestion du menu mobile
class MobileMenu {
    constructor() {
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebar = document.querySelector('.sidebar');
        this.mainContent = document.querySelector('.main-content');
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
            
            // Créer l'overlay
            this.createOverlay();
            
            // Fermer le menu quand on clique sur l'overlay
            if (this.overlay) {
                this.overlay.addEventListener('click', () => {
                    this.closeMenu();
                });
            }
            
            // Gérer le redimensionnement de la fenêtre
            window.addEventListener('resize', () => {
                if (window.innerWidth > 992) {
                    this.closeMenu();
                }
            });
            
            // Empêcher la fermeture quand on clique dans le sidebar
            this.sidebar.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Initialiser les gestes de swipe
            this.initSwipeGesture();
        }
    }
    
    initSwipeGesture() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        }, false);
        
        // Pour le swipe sur le menu ouvert
        if (this.sidebar) {
            this.sidebar.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, false);
            
            this.sidebar.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSidebarSwipe(touchStartX, touchEndX);
            }, false);
        }
    }
    
    handleSwipe(touchStartX, touchEndX) {
        const swipeDistance = touchEndX - touchStartX;
        
        // Swipe droite pour ouvrir (depuis le bord gauche)
        if (swipeDistance > 50 && touchStartX < 30 && !this.sidebar.classList.contains('active')) {
            this.openMenu();
        }
    }
    
    handleSidebarSwipe(touchStartX, touchEndX) {
        const swipeDistance = touchEndX - touchStartX;
        
        // Swipe gauche pour fermer
        if (swipeDistance < -50 && this.sidebar.classList.contains('active')) {
            this.closeMenu();
        }
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay';
        document.body.appendChild(this.overlay);
    }
    
    toggleMenu() {
        if (this.sidebar.classList.contains('active')) {
            this.closeMenu();
                        
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        if (this.sidebar) {
            this.sidebar.classList.add('active'); 
            this.sidebar.style.display = 'block'; // Ensure sidebar is visible
            this.sidebar.style.transform = 'translateX(0%)';
        }
        if (this.overlay) {
            this.overlay.classList.add('active');
        }
        document.body.classList.add('menu-open');
    }
    
    closeMenu() {
        if (this.sidebar) {
            this.sidebar.classList.remove('active');
            this.sidebar.style.transform = 'translateX(-100%)';
        }
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
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
        
        if (!statsSection) {
            // Créer la section
            statsSection = document.createElement('div');
            statsSection.className = 'statistics-section';
            const currencySymbol = localStorage.getItem('currency') || 'XOF'; // Extraire le symbole monétaire
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
                            <span class="stat-value" id="statsTotal">0 ${currencySymbol}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <span class="material-icons">date_range</span>
                        </div>
                        <div class="stat-details">
                            <span class="stat-label">Ce mois</span>
                            <span class="stat-value" id="statsMonth">0 ${currencySymbol}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <span class="material-icons">trending_up</span>
                        </div>
                        <div class="stat-details">
                            <span class="stat-label">Moyenne</span>
                            <span class="stat-value" id="statsAverage">0 ${currencySymbol}</span>
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
    let currencySymbol = localStorage.getItem('currency') || 'XOF'; // Extraire le symbole monétaire
    if (!settingsSection) {
        // Créer la section avec les options de devise et stockage
        settingsSection = document.createElement('div');
        settingsSection.className = 'settings-section';
        settingsSection.innerHTML = `
            <div class="section-header">
                <h2>
                    <span class="material-icons">settings</span>
                    Paramètres
                </h2>
            </div>
            
            <!-- Carte: Choix de la monnaie -->
            <div class="settings-card">
                <h3>
                    <span class="material-icons">attach_money</span>
                    Monnaie (Dévise)
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
                        <span class="preview-label">Aperçu:</span>
                        <span class="preview-value" id="currencyPreview">1 234,56 ${this.getCurrencySymbol(localStorage.getItem('currency') || 'EUR')}</span>
                    </div>
                </div>
            </div>
            
            <!-- Carte: Format d'affichage -->
            <div class="settings-card">
                <h3>
                    <span class="material-icons">format_list_bulleted</span>
                    Format d'affichage
                </h3>
                <div class="format-options">
                    <label class="format-option">
                        <input type="radio" name="format" value="space" ${localStorage.getItem('format') !== 'comma' ? 'checked' : ''}>
                        <span class="material-icons">123</span>
                        <span>1 234,56 </span>
                        <small>(espace pour les milliers)</small>
                    </label>
                    
                    <label class="format-option">
                        <input type="radio" name="format" value="comma" ${localStorage.getItem('format') === 'comma' ? 'checked' : ''}>
                        <span class="material-icons">123</span>
                        <span>1,234.56 ${currencySymbol}</span>
                        <small>(virgule pour les milliers)</small>
                    </label>
                    
                    <label class="format-option">
                        <input type="radio" name="format" value="none" ${localStorage.getItem('format') === 'none' ? 'checked' : ''}>
                        <span class="material-icons">123</span>
                        <span>1234.56 ${currencySymbol}</span>
                        <small>(sans séparateur)</small>
                    </label>
                </div>
            </div>
            
            <!-- Carte: Emplacement de stockage -->
            <div class="settings-card">
                <h3>
                    <span class="material-icons">storage</span>
                    Emplacement de stockage
                </h3>
                
                <div class="storage-options">
                    <!-- Stockage local -->
                    <label class="storage-option ${localStorage.getItem('storageLocation') !== 'drive' ? 'selected' : ''}">
                        <input type="radio" name="storageLocation" value="local" ${localStorage.getItem('storageLocation') !== 'drive' ? 'checked' : ''}>
                        <span class="material-icons">phone_android</span>
                        <div class="storage-desc">
                            <span class="storage-title">Stockage local</span>
                            <span class="storage-detail">Données sauvegardées uniquement sur cet appareil</span>
                        </div>
                    </label>
                    
                    <!-- Google Drive -->
                    <label class="storage-option ${localStorage.getItem('storageLocation') === 'drive' ? 'selected' : ''}">
                        <input type="radio" name="storageLocation" value="drive" ${localStorage.getItem('storageLocation') === 'drive' ? 'checked' : ''}>
                        <span class="material-icons">cloud</span>
                        <div class="storage-desc">
                            <span class="storage-title">Google Drive</span>
                            <span class="storage-detail">Synchronisation cloud accessible partout</span>
                        </div>
                        ${localStorage.getItem('storageLocation') === 'drive' && !window.driveSync?.isAuthenticated ? 
                            '<span class="warning-badge">Non connecté</span>' : ''}
                    </label>
                    
                    <!-- Stockage automatique -->
                    <label class="storage-option">
                        <input type="radio" name="storageLocation" value="auto">
                        <span class="material-icons">sync_alt</span>
                        <div class="storage-desc">
                            <span class="storage-title">Mode automatique</span>
                            <span class="storage-detail">Local si hors ligne, Cloud si disponible</span>
                        </div>
                    </label>
                </div>
                
                <div class="drive-status-card" id="driveStatusInSettings">
                    <!-- Statut Drive affiché dynamiquement -->
                </div>
            </div>
            
            <!-- Carte: Sauvegarde automatique -->
            <div class="settings-card">
                <h3>
                    <span class="material-icons">backup</span>
                    Sauvegarde automatique
                </h3>
                
                <div class="auto-backup-options">
                    <label class="toggle-option">
                        <input type="checkbox" id="autoBackup" ${localStorage.getItem('autoBackup') !== 'false' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Activer la sauvegarde automatique</span>
                    </label>
                    
                    <div class="backup-frequency" id="backupFrequencyGroup" style="display: ${localStorage.getItem('autoBackup') !== 'false' ? 'block' : 'none'}">
                        <label>Fréquence des sauvegardes</label>
                        <select id="backupFrequency">
                            <option value="1" ${localStorage.getItem('backupFrequency') === '1' ? 'selected' : ''}>Tous les jours</option>
                            <option value="7" ${localStorage.getItem('backupFrequency') === '7' ? 'selected' : ''}>Toutes les semaines</option>
                            <option value="30" ${localStorage.getItem('backupFrequency') === '30' ? 'selected' : ''}>Tous les mois</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Carte: Actions rapides -->
            <div class="settings-card">
                <h3>
                    <span class="material-icons">bolt</span>
                    Actions rapides
                </h3>
                
                <div class="quick-actions">
                    <button id="applySettingsBtn" class="btn-primary">
                        <span class="material-icons">check</span>
                        Appliquer les paramètres
                    </button>
                    
                    <button id="resetSettingsBtn" class="btn-secondary">
                        <span class="material-icons">restart_alt</span>
                        Réinitialiser
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

// Initialiser les événements des paramètres
initSettingsEvents() {
    // Change monnaie
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
            
            // Appliquer immédiatement
            this.applyCurrencyToDisplay(currency);
        });
    }
    
    // Change format
    const formatRadios = document.querySelectorAll('input[name="format"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                localStorage.setItem('format', e.target.value);
                this.applyFormatToDisplay(e.target.value);
            }
        });
    });
    
    // Change stockage
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
    
    // Auto backup toggle
    const autoBackup = document.getElementById('autoBackup');
    const backupFrequencyGroup = document.getElementById('backupFrequencyGroup');
    
    if (autoBackup) {
        autoBackup.addEventListener('change', (e) => {
            localStorage.setItem('autoBackup', e.target.checked);
            backupFrequencyGroup.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    // Fréquence backup
    const backupFrequency = document.getElementById('backupFrequency');
    if (backupFrequency) {
        backupFrequency.addEventListener('change', (e) => {
            localStorage.setItem('backupFrequency', e.target.value);
        });
    }
    
    // Bouton Appliquer
    const applyBtn = document.getElementById('applySettingsBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {

            // Appliquer tous les paramètres
            const currency = document.getElementById('currencySelect').value;
            const format = document.querySelector('input[name="format"]:checked').value;
            const storage = document.querySelector('input[name="storageLocation"]:checked').value;
                        console.log('Application des paramètres...'+currency);
            localStorage.setItem('currency', currency);
            localStorage.setItem('format', format);
            localStorage.setItem('storageLocation', storage);
            
            // Appliquer à l'affichage
            this.applyCurrencyToDisplay(currency);
            this.applyFormatToDisplay(format);
            
            // Recharger les dépenses pour voir le changement
            if (window.app) {
                window.app.loadExpenses();
                window.app.showNotification('Paramètres appliqués', 'success');
            }
        });
    }
    
    // Bouton Réinitialiser
    const resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Réinitialiser tous les paramètres ?')) {
                localStorage.removeItem('currency');
                localStorage.removeItem('format');
                localStorage.removeItem('storageLocation');
                localStorage.removeItem('autoBackup');
                
                // Recharger la page
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
            const currencySymbol = localStorage.getItem('currency') || 'XOF';
            budgetEl.textContent = budget + ' ' + currencySymbol;
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
        const currencySymbol = localStorage.getItem('currency') || 'XOF';
        
        if (statsTotal) statsTotal.textContent = total.toFixed(2) + ' ' + currencySymbol;
        if (statsMonth) statsMonth.textContent = monthTotal.toFixed(2) + ' ' + currencySymbol;
        if (statsAverage) statsAverage.textContent = avg.toFixed(2) + ' ' + currencySymbol;
    }
    
    closeMobileMenu() {
        // Fermer le menu sur mobile
        if (window.innerWidth <= 992) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            
            sidebar.style.transform = 'translateX(-100%)';

            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
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

class NotificationSystem {
    constructor() {
        this.budget = parseFloat(localStorage.getItem('budget')) || 1000;
        this.notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
        this.reminderTime = localStorage.getItem('reminderTime') || '20:00'; // 20h par défaut
        this.lastNotificationDate = localStorage.getItem('lastNotificationDate') || null;
        
        this.init();
    }
    
    init() {
        // Demander la permission si ce n'est pas déjà fait
        this.requestPermission();
        
        // Vérifier le budget au chargement
        this.checkBudget();
        
        // Programmer les rappels quotidiens
        this.scheduleDailyReminder();
        
        // Vérifier périodiquement (toutes les heures)
        setInterval(() => {
            this.checkBudget();
        }, 60 * 60 * 1000); // Toutes les heures
    }
    
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
    
    async showNotification(title, options = {}) {
        if (!('Notification' in window)) return false;
        
        // Vérifier si les notifications sont activées
        if (!this.notificationsEnabled) return false;
        
        // Vérifier la permission
        if (Notification.permission !== 'granted') {
            console.log('Permission non accordée');
            return false;
        }
        
        // Options par défaut
        const defaultOptions = {
            icon: '/icons/image.png',
            badge: '/icons/image.png',
            silent: false,
            vibrate: [200, 100, 200],
            requireInteraction: true // Reste jusqu'à ce que l'utilisateur clique
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
    
    async checkBudget() {
        if (!window.app || !window.app.db) return;
        
        try {
            const expenses = await window.app.db.getAllExpenses();
            const currencySymbol = localStorage.getItem('currency') || 'XOF';
            // Calculer le total des dépenses du mois
            const now = new Date();
            const monthExpenses = expenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            
            const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            const remaining = this.budget - monthTotal;
            const percentageUsed = (monthTotal / this.budget) * 100;
            
            // Mettre à jour l'affichage
            this.updateBudgetDisplay(remaining, percentageUsed, currencySymbol);
            
            // Vérifier les seuils
            if (remaining < 0) {
                // Budget dépassé
                this.showNotification('⚠️ Budget dépassé !', {
                    body: `Vous avez dépassé votre budget de ${Math.abs(remaining).toFixed(2)} ${currencySymbol}.`,
                    tag: 'budget-over'
                });
            } else if (percentageUsed >= 90 && percentageUsed < 100) {
                // 90% utilisé
                this.showNotification('⚠️ Budget presque épuisé', {
                    body: `Vous avez utilisé ${percentageUsed.toFixed(0)}% de votre budget. Il reste ${remaining.toFixed(2)} ${currencySymbol}.`,
                    tag: 'budget-warning'
                });
            } else if (percentageUsed >= 75 && percentageUsed < 90) {
                // 75% utilisé
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
        // Mettre à jour l'affichage du budget restant
        const budgetEl = document.getElementById('budgetRemaining');
        const currencySymbol = localStorage.getItem('currency') || 'XOF';
        if (budgetEl) {
            budgetEl.textContent = remaining.toFixed(2) + ' ' + currencySymbol;
            
            // Changer la couleur selon le niveau
            if (remaining < 0) {
                budgetEl.style.color = '#ef233c'; // Rouge
            } else if (percentageUsed >= 90) {
                budgetEl.style.color = '#ffb703'; // Orange
            } else {
                budgetEl.style.color = ''; // Défaut
            }
        }
        
        // Mettre à jour la barre de progression si elle existe
        const progressBar = document.querySelector('.budget-progress-bar');
        if (progressBar) {
            progressBar.style.width = Math.min(percentageUsed, 100) + '%';
            progressBar.style.backgroundColor = remaining < 0 ? '#ef233c' : 
                                               percentageUsed >= 90 ? '#ffb703' : '#4361ee';
        }
    }
    
    scheduleDailyReminder() {
        // Vérifier toutes les minutes
        setInterval(() => {
            this.checkDailyReminder();
        }, 60 * 1000); // Toutes les minutes
    }
    
    checkDailyReminder() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Vérifier si c'est l'heure du rappel
        if (currentTime !== this.reminderTime) return;
        
        // Vérifier si on a déjà notifié aujourd'hui
        const today = now.toDateString();
        if (this.lastNotificationDate === today) return;
        
        // Vérifier si on a déjà des dépenses aujourd'hui
        this.checkTodayExpenses().then(hasExpenses => {
            if (!hasExpenses) {
                // Pas de dépenses aujourd'hui -> rappel
                this.showNotification('📝 Rappel quotidien', {
                    body: 'Vous n\'avez pas encore enregistré de dépenses aujourd\'hui. Pensez à les noter !',
                    tag: 'daily-reminder'
                });
                
                // Marquer comme notifié
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
    
    // Méthodes pour l'interface
    updateSettings(budget, enabled, time) {
        this.budget = budget;
        this.notificationsEnabled = enabled;
        this.reminderTime = time;
        
        // Sauvegarder
        localStorage.setItem('budget', budget);
        localStorage.setItem('notificationsEnabled', enabled);
        localStorage.setItem('reminderTime', time);
        
        // Vérifier immédiatement
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
    panel.className = 'notification-panel';
    panel.id = 'notificationPanel';
    panel.innerHTML = `
        <div class="notification-header">
            <h3>Notifications</h3>
            <span class="material-icons close-panel">close</span>
        </div>
        <div class="notification-settings">
            <div class="setting-item">
                <label>Budget mensuel (${localStorage.getItem('currency') || 'XOF'})</label>
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
// INITIALISATION
// ============================================

// Initialiser après le chargement
document.addEventListener('DOMContentLoaded', function() {
    // Ajouter le bouton de notification
    setTimeout(() => {
        addNotificationButton();
        
        // Initialiser le système de notifications
        window.notificationSystem = new NotificationSystem();
        
        // Ajouter une notification de bienvenue après 2 secondes
        setTimeout(() => {
            if (window.notificationSystem.notificationsEnabled) {
                window.notificationSystem.showNotification('👋 Bienvenue !', {
                    body: 'N\'oubliez pas d\'enregistrer vos dépenses chaque jour.',
                    tag: 'welcome'
                });
            }
        }, 2000);
        
    }, 500);
});

// ============================================
// INITIALISATION
// ============================================


// Initialiser l'application et le menu mobile quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation de l\'application...');
    
    try {
        // Ajouter les styles
        addSectionStyles();
        
        // 1. CRÉER LA BASE DE DONNÉES
        const db = new ExpenseDatabase();
        
        // 2. CRÉER GOOGLE DRIVE SYNC
        const driveSync = new GoogleDriveSync(db);
        
        // 3. CRÉER L'APPLICATION AVEC LES DÉPENDANCES
        const app = new ExpenseApp(db, driveSync);
        
        // 4. EXPOSER GLOBALEMENT
        window.app = app;
        window.driveSync = driveSync;
        
        // 5. INITIALISER LA NAVIGATION
        setTimeout(() => {
            window.navigation = new NavigationManager();
        }, 200);
        
        // 6. INITIALISER LE MENU MOBILE
        new MobileMenu();
        
        // 7. AJOUTER LE BOUTON GOOGLE DRIVE
        setTimeout(() => {
            addGoogleDriveButton();
        }, 500);
        
        // 8. GÉRER LE BOUTON DONATE
        const donateBtn = document.getElementById('btn-donate');
        if (donateBtn) {
            donateBtn.addEventListener('click', () => {
                const phoneNumber = '2290166344554';
                const message = 'Bonjour, je souhaiterais effectuer un don. Quel est votre moyen de paiement ?';
                const encodedMessage = encodeURIComponent(message);
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
                window.open(whatsappUrl, '_blank');
            });
        }

        console.log('✅ Application initialisée avec succès');

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    }
});


// ============================================
// ENREGISTREMENT DU SERVICE WORKER (PWA)
// ============================================

// Notification de mise à jour
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <span class="material-icons">system_update</span>
            <span>Une nouvelle version est disponible</span>
            <button onclick="updateApp()" class="btn-update">Mettre à jour</button>
        </div>
    `;
    document.body.appendChild(notification);
}

// Mettre à jour l'application
window.updateApp = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    }
};

// ============================================
// GESTION DE L'INSTALLATION PWA
// ============================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique
    e.preventDefault();
    deferredPrompt = e;
    
    // Afficher le bouton d'installation après un délai
    setTimeout(() => {
        showInstallPrompt();
    }, 30000); // Après 30 secondes
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
            <p>Installez Gestion Dépenses sur votre appareil pour un accès rapide et le mode hors ligne.</p>
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
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Installation ${outcome}`);
            deferredPrompt = null;
            prompt.remove();
        }
    });
    
    document.getElementById('laterBtn').addEventListener('click', () => {
        prompt.remove();
        // Réafficher plus tard
        setTimeout(showInstallPrompt, 7 * 24 * 60 * 60 * 1000); // 7 jours
    });
}

// Détecter l'installation
window.addEventListener('appinstalled', (e) => {
    console.log('✅ Application installée');
    const prompt = document.getElementById('installPrompt');
    if (prompt) prompt.remove();
});

// Ajouter les animations CSS pour les notifications (une seule fois)
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
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
    document.head.appendChild(style);
}