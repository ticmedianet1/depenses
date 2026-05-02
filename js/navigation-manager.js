// ============================================
// GESTION DE LA NAVIGATION - VERSION CORRIGÉE
// ============================================

class NavigationManager {
    constructor() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.sidebar = document.querySelector('.sidebar');
        this.overlay = document.querySelector('.sidebar-overlay');
        this.settingsSection = null; // Stocker la référence
        this.statsSection = null;
        this.init();
    }
    
    init() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const buttonText = item.querySelector('span:last-child').textContent.trim();
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
        // Cacher la section des dépenses
        const expensesSection = document.querySelector('.expenses-section');
        if (expensesSection) expensesSection.style.display = 'block';
        
        // Cacher les sections spéciales
        if (this.statsSection) this.statsSection.style.display = 'none';
        if (this.settingsSection) this.settingsSection.style.display = 'none';
    }
    
    showDashboard() {
        console.log('Dashboard affiché');
        const expensesSection = document.querySelector('.expenses-section');
        if (expensesSection) expensesSection.style.display = 'block';
        
        // Mettre à jour le titre
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<span class="material-icons">receipt_long</span> Dépenses récentes';
        }
        
        if (window.app) window.app.loadExpenses();
        
        // Cacher les sections spéciales
        if (this.statsSection) this.statsSection.style.display = 'none';
        if (this.settingsSection) this.settingsSection.style.display = 'none';
    }
    
    showAllExpenses() {
        console.log('Toutes les dépenses');
        
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<span class="material-icons">receipt</span> Toutes les dépenses';
        }
        
        const expensesSection = document.querySelector('.expenses-section');
        if (expensesSection) expensesSection.style.display = 'block';
        
        if (this.statsSection) this.statsSection.style.display = 'none';
        if (this.settingsSection) this.settingsSection.style.display = 'none';
        
        if (window.app && window.app.db) {
            window.app.db.getAllExpenses().then(expenses => {
                window.app.displayExpenses(expenses);
            });
        }
    }
    
    showStatistics() {
        console.log('Statistiques');
        
        if (!this.statsSection) {
            this.createStatisticsSection();
        }
        
        const expensesSection = document.querySelector('.expenses-section');
        if (expensesSection) expensesSection.style.display = 'none';
        
        if (this.statsSection) this.statsSection.style.display = 'block';
        if (this.settingsSection) this.settingsSection.style.display = 'none';
        
        this.loadStatistics();
    }
    
    createStatisticsSection() {
        this.statsSection = document.createElement('div');
        this.statsSection.className = 'statistics-section';
        const currency = localStorage.getItem('currency') || 'XOF';
        
        this.statsSection.innerHTML = `
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
        if (expensesSection) {
            expensesSection.parentNode.insertBefore(this.statsSection, expensesSection.nextSibling);
        }
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
        
        // Supprimer l'ancienne section si elle existe pour la recréer
        if (this.settingsSection) {
            this.settingsSection.remove();
            this.settingsSection = null;
        }
        
        this.createSettingsSection();
        
        const expensesSection = document.querySelector('.expenses-section');
        if (expensesSection) expensesSection.style.display = 'none';
        
        if (this.statsSection) this.statsSection.style.display = 'none';
        if (this.settingsSection) this.settingsSection.style.display = 'block';
    }
    
    createSettingsSection() {
        this.settingsSection = document.createElement('div');
        this.settingsSection.className = 'settings-section';
        
        const currentCurrency = localStorage.getItem('currency') || 'XOF';
        const currentBudget = localStorage.getItem('budget') || 1000;
        const currentTheme = localStorage.getItem('theme') || 'light';
        
        this.settingsSection.innerHTML = `
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
                        <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>Euro (€) - EUR</option>
                        <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>Dollar ($) - USD</option>
                        <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>Livre sterling (£) - GBP</option>
                        <option value="CHF" ${currentCurrency === 'CHF' ? 'selected' : ''}>Franc suisse (CHF) - CHF</option>
                        <option value="CAD" ${currentCurrency === 'CAD' ? 'selected' : ''}>Dollar canadien (CAD) - CAD</option>
                        <option value="JPY" ${currentCurrency === 'JPY' ? 'selected' : ''}>Yen japonais (¥) - JPY</option>
                        <option value="CNY" ${currentCurrency === 'CNY' ? 'selected' : ''}>Yuan chinois (¥) - CNY</option>
                        <option value="XOF" ${currentCurrency === 'XOF' ? 'selected' : ''}>Franc CFA (FCFA) - XOF</option>
                        <option value="XAF" ${currentCurrency === 'XAF' ? 'selected' : ''}>Franc CFA (FCFA) - XAF</option>
                        <option value="MAD" ${currentCurrency === 'MAD' ? 'selected' : ''}>Dirham marocain (MAD) - MAD</option>
                        <option value="DZD" ${currentCurrency === 'DZD' ? 'selected' : ''}>Dinar algérien (DZD) - DZD</option>
                        <option value="TND" ${currentCurrency === 'TND' ? 'selected' : ''}>Dinar tunisien (TND) - TND</option>
                        <option value="NGN" ${currentCurrency === 'NGN' ? 'selected' : ''}>Naira nigérian (₦) - NGN</option>
                        <option value="ZAR" ${currentCurrency === 'ZAR' ? 'selected' : ''}>Rand sud-africain (ZAR) - ZAR</option>
                        <option value="BRL" ${currentCurrency === 'BRL' ? 'selected' : ''}>Real brésilien (BRL) - BRL</option>
                        <option value="RUB" ${currentCurrency === 'RUB' ? 'selected' : ''}>Rouble russe (RUB) - RUB</option>
                        <option value="INR" ${currentCurrency === 'INR' ? 'selected' : ''}>Roupie indienne (₹) - INR</option>
                        <option value="AUD" ${currentCurrency === 'AUD' ? 'selected' : ''}>Dollar australien (AUD) - AUD</option>
                    </select>
                    
                    <div class="currency-preview">
                        <span class="preview-label" data-i18n="preview">Aperçu:</span>
                        <span class="preview-value" id="currencyPreview">1 234,56 ${this.getCurrencySymbol(currentCurrency)}</span>
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
                        <span>1 234,56 ${this.getCurrencySymbol(currentCurrency)}</span>
                        <small data-i18n="spaceFormat">(espace pour les milliers)</small>
                    </label>
                    
                    <label class="format-option">
                        <input type="radio" name="format" value="comma" ${localStorage.getItem('format') === 'comma' ? 'checked' : ''}>
                        <span class="material-icons">123</span>
                        <span>1,234.56 ${this.getCurrencySymbol(currentCurrency)}</span>
                        <small data-i18n="commaFormat">(virgule pour les milliers)</small>
                    </label>
                    
                    <label class="format-option">
                        <input type="radio" name="format" value="none" ${localStorage.getItem('format') === 'none' ? 'checked' : ''}>
                        <span class="material-icons">123</span>
                        <span>1234.56 ${this.getCurrencySymbol(currentCurrency)}</span>
                        <small data-i18n="noFormat">(sans séparateur)</small>
                    </label>
                </div>
            </div>

            <div class="settings-card">
                <h3 data-i18n="monthlyBudget">Budget mensuel</h3>
                <div class="setting-item">
                    <label data-i18n="maximumBudget">Budget maximum</label>
                    <input type="number" id="budgetInput" value="${currentBudget}" step="50">
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
                        <option value="light" ${currentTheme === 'light' ? 'selected' : ''} data-i18n="light">Clair</option>
                        <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''} data-i18n="dark">Sombre</option>
                    </select>
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
                        <span class="lang-name">Français</span>
                    </label>
                    
                    <label class="language-option ${localStorage.getItem('language') === 'en' ? 'selected' : ''}">
                        <input type="radio" name="language" value="en" ${localStorage.getItem('language') === 'en' ? 'checked' : ''}>
                        <span class="lang-name">English</span>
                    </label>
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
                        <span data-i18n="applySettings">Appliquer</span>
                    </button>
                    <button id="resetSettingsBtn" class="btn-secondary">
                        <span class="material-icons">restart_alt</span>
                        <span data-i18n="reset">Réinitialiser</span>
                    </button>
                </div>
            </div>
        `;
        
        const expensesSection = document.querySelector('.expenses-section');
        if (expensesSection) {
            expensesSection.parentNode.insertBefore(this.settingsSection, expensesSection.nextSibling);
        }
        
        // Initialiser les événements après la création
        setTimeout(() => this.initSettingsEvents(), 100);
    }
    
    initSettingsEvents() {
        const currencySelect = document.getElementById('currencySelect');
        const budgetInput = document.getElementById('budgetInput');
        const themeSelect = document.getElementById('themeSelect');
        const applyBtn = document.getElementById('applySettingsBtn');
        const resetBtn = document.getElementById('resetSettingsBtn');
        
        // Aperçu de la devise
        if (currencySelect) {
            currencySelect.addEventListener('change', (e) => {
                const preview = document.getElementById('currencyPreview');
                if (preview) {
                    preview.textContent = `1 234,56 ${this.getCurrencySymbol(e.target.value)}`;
                }
            });
        }
        
        // Appliquer les paramètres
        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                const currency = currencySelect?.value || 'XOF';
                const budget = budgetInput?.value || 1000;
                const theme = themeSelect?.value || 'light';
                const format = document.querySelector('input[name="format"]:checked')?.value || 'space';
                const language = document.querySelector('input[name="language"]:checked')?.value || 'fr';
                
                // Sauvegarder dans localStorage
                localStorage.setItem('currency', currency);
                localStorage.setItem('budget', budget);
                localStorage.setItem('theme', theme);
                localStorage.setItem('format', format);
                localStorage.setItem('language', language);
                
                // Sauvegarder dans le compte
                if (window.app?.db) {
                    await window.app.db.saveAccountSettings({ currency, budget, theme, format });
                    
                    // Mettre à jour l'application
                    window.app.currentCurrency = currency;
                    window.app.currentBudget = parseFloat(budget);
                    document.body.setAttribute('data-theme', theme);
                    window.app.loadExpenses();
                    window.app.showNotification('Paramètres appliqués', 'success');
                }
            });
        }
        
        // Réinitialiser
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Réinitialiser tous les paramètres ?')) {
                    localStorage.clear();
                    window.location.reload();
                }
            });
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
