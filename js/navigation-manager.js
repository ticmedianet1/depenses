// ============================================
// GESTION DE LA NAVIGATION
// ============================================

class NavigationManager {
    constructor() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.sidebar = document.querySelector('.sidebar');
        this.overlay = document.querySelector('.sidebar-overlay');
        this.init();
    }
    
    init() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const buttonText = item.querySelector('span:last-child').textContent.trim();
                console.log('Clic sur:', buttonText);
                this.setActiveItem(item);
                this.showSection(buttonText);
                this.closeMobileMenu();
            });
        });
        console.log('Navigation prête !');
    }
    
    setActiveItem(clickedItem) {
        this.navItems.forEach(item => item.classList.remove('active'));
        clickedItem.classList.add('active');
    }
    
    showSection(sectionName) {
        this.hideAllSpecialSections();
        
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
        const statsSection = document.querySelector('.statistics-section');
        const settingsSection = document.querySelector('.settings-section');
        const expensesSection = document.querySelector('.expenses-section');
        
        if (statsSection) statsSection.style.display = 'none';
        if (settingsSection) settingsSection.style.display = 'none';
        if (expensesSection) expensesSection.style.display = 'block';
    }
    
    showDashboard() {
        console.log('Dashboard affiché');
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<span class="material-icons">receipt_long</span> Dépenses récentes';
        }
        if (window.app) window.app.loadExpenses();
    }
    
    showAllExpenses() {
        console.log('Toutes les dépenses');
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<span class="material-icons">receipt</span> Toutes les dépenses';
        }
        if (window.app && window.app.db) {
            window.app.db.getAllExpenses().then(expenses => {
                window.app.displayExpenses(expenses);
            });
        }
    }
    
    showStatistics() {
        console.log('Statistiques');
        let statsSection = document.querySelector('.statistics-section');
        const currency = localStorage.getItem('currency') || 'XOF';
        
        if (!statsSection) {
            statsSection = document.createElement('div');
            statsSection.className = 'statistics-section';
            statsSection.innerHTML = `
                <div class="section-header">
                    <h2><span class="material-icons">pie_chart</span> Statistiques</h2>
                </div>
                <div class="stats-placeholder">
                    <div class="stat-card">
                        <div class="stat-icon"><span class="material-icons">show_chart</span></div>
                        <div class="stat-details">
                            <span class="stat-label">Total</span>
                            <span class="stat-value" id="statsTotal">0 ${currency}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><span class="material-icons">date_range</span></div>
                        <div class="stat-details">
                            <span class="stat-label">Ce mois</span>
                            <span class="stat-value" id="statsMonth">0 ${currency}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><span class="material-icons">trending_up</span></div>
                        <div class="stat-details">
                            <span class="stat-label">Moyenne</span>
                            <span class="stat-value" id="statsAverage">0 ${currency}</span>
                        </div>
                    </div>
                </div>
            `;
            const expensesSection = document.querySelector('.expenses-section');
            if (expensesSection) expensesSection.parentNode.insertBefore(statsSection, expensesSection.nextSibling);
        }
        
        document.querySelector('.expenses-section').style.display = 'none';
        statsSection.style.display = 'block';
        this.loadStatistics();
    }
    
    async loadStatistics() {
        if (!window.app || !window.app.db) return;
        
        const expenses = await window.app.db.getAllExpenses();
        const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const avg = expenses.length > 0 ? total / expenses.length : 0;
        
        const now = new Date();
        const monthExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        const currency = localStorage.getItem('currency') || 'XOF';
        const statsTotal = document.getElementById('statsTotal');
        const statsMonth = document.getElementById('statsMonth');
        const statsAverage = document.getElementById('statsAverage');
        
        if (statsTotal) statsTotal.textContent = total.toFixed(2) + ' ' + currency;
        if (statsMonth) statsMonth.textContent = monthTotal.toFixed(2) + ' ' + currency;
        if (statsAverage) statsAverage.textContent = avg.toFixed(2) + ' ' + currency;
    }
    
    showSettings() {
        console.log('Affichage des paramètres');
        let settingsSection = document.querySelector('.settings-section');
        
        if (!settingsSection) {
            settingsSection = document.createElement('div');
            settingsSection.className = 'settings-section';
            settingsSection.innerHTML = `
                <div class="section-header">
                    <h2><span class="material-icons">settings</span> Paramètres</h2>
                </div>
                <div class="settings-card">
                    <h3>Monnaie</h3>
                    <select id="currencySelect" class="currency-select">
                        <option value="XOF">Franc CFA (FCFA) - XOF</option>
                        <option value="EUR">Euro (€) - EUR</option>
                        <option value="USD">Dollar ($) - USD</option>
                    </select>
                </div>
                <div class="settings-card">
                    <h3>Budget mensuel</h3>
                    <input type="number" id="budgetInput" value="${localStorage.getItem('budget') || 1000}" step="50">
                </div>
                <div class="settings-card">
                    <h3>Thème</h3>
                    <select id="themeSelect">
                        <option value="light">Clair</option>
                        <option value="dark">Sombre</option>
                    </select>
                </div>
                <div class="settings-card">
                    <div class="quick-actions">
                        <button id="applySettingsBtn" class="btn-primary">Appliquer</button>
                        <button id="resetSettingsBtn" class="btn-secondary">Réinitialiser</button>
                    </div>
                </div>
            `;
            
            const expensesSection = document.querySelector('.expenses-section');
            if (expensesSection) expensesSection.parentNode.insertBefore(settingsSection, expensesSection.nextSibling);
            
            setTimeout(() => this.initSettingsEvents(), 100);
        }
        
        document.querySelector('.expenses-section').style.display = 'none';
        const statsSection = document.querySelector('.statistics-section');
        if (statsSection) statsSection.style.display = 'none';
        settingsSection.style.display = 'block';
    }
    
    initSettingsEvents() {
        const applyBtn = document.getElementById('applySettingsBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                const currency = document.getElementById('currencySelect')?.value || 'XOF';
                const budget = document.getElementById('budgetInput')?.value || 1000;
                const theme = document.getElementById('themeSelect')?.value || 'light';
                
                if (window.app?.db) {
                    await window.app.db.saveAccountSettings({ currency, budget, theme });
                    
                    // Mettre à jour l'application
                    window.app.currentCurrency = currency;
                    window.app.currentBudget = parseFloat(budget);
                    document.body.setAttribute('data-theme', theme);
                    window.app.loadExpenses();
                    window.app.showNotification('Paramètres appliqués', 'success');
                }
            });
        }
        
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Réinitialiser tous les paramètres ?')) {
                    localStorage.clear();
                    window.location.reload();
                }
            });
        }
        
        // Charger les valeurs actuelles
        const settings = window.app?.db ? await window.app.db.getAccountSettings() : null;
        if (settings) {
            const currencySelect = document.getElementById('currencySelect');
            const budgetInput = document.getElementById('budgetInput');
            const themeSelect = document.getElementById('themeSelect');
            if (currencySelect) currencySelect.value = settings.currency || 'XOF';
            if (budgetInput) budgetInput.value = settings.budget || 1000;
            if (themeSelect) themeSelect.value = settings.theme || 'light';
        }
    }
    
    closeMobileMenu() {
        if (window.innerWidth <= 992) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    }
}
