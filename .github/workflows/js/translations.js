// ============================================
// GESTION DES LANGUES (FR/EN)
// ============================================

const translations = {
    fr: {
        // Menu
        dashboard: 'Tableau de bord',
        expenses: 'Dépenses',
        statistics: 'Statistiques',
        settings: 'Paramètres',
        
        // En-tête
        searchPlaceholder: 'Rechercher une dépense...',
        syncStatus: 'Synchronisé',
        syncing: 'Synchronisation...',
        offline: 'Hors ligne',
        
        // Statistiques
        totalExpenses: 'Total des dépenses',
        expenseCount: 'Nombre de dépenses',
        average: 'Moyenne',
        budgetRemaining: 'Budget restant',
        thisMonth: 'Ce mois',
        perExpense: 'Par dépense',
        
        // Formulaire d'ajout
        addExpense: 'Ajouter une dépense',
        expenseName: 'Nom de la dépense',
        amount: 'Montant',
        date: 'Date et heure',
        addButton: 'Ajouter',
        
        // Filtres
        filterByName: 'Filtrer par nom...',
        filterByDate: 'Par date',
        filterByMonth: 'Par mois',
        clearFilters: 'Effacer',
        all: 'Toutes',
        today: 'Aujourd\'hui',
        thisWeek: 'Cette semaine',
        thisMonth: 'Ce mois',
        
        // Liste des dépenses
        recentExpenses: 'Dépenses récentes',
        allExpenses: 'Toutes les dépenses',
        noExpenses: 'Aucune dépense enregistrée',
        pending: 'En attente de synchronisation',
        
        // Actions
        delete: 'Supprimer',
        edit: 'Modifier',
        save: 'Enregistrer',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        
        // Notifications
        expenseAdded: 'Dépense ajoutée avec succès!',
        expenseDeleted: 'Dépense supprimée avec succès',
        fillAllFields: 'Veuillez remplir tous les champs',
        syncing: 'Synchronisation en cours...',
        syncSuccess: 'Synchronisation terminée !',
        syncError: 'Erreur de synchronisation',
        
        // Paramètres
        currency: 'Monnaie',
        language: 'Langue',
        french: 'Français',
        english: 'Anglais',
        theme: 'Thème',
        light: 'Clair',
        dark: 'Sombre',
        auto: 'Auto',
        budget: 'Budget mensuel',
        notifications: 'Notifications',
        saveSettings: 'Appliquer',
        resetSettings: 'Réinitialiser',
        
        // Confirmation
        confirmDelete: 'Êtes-vous sûr de vouloir supprimer cette dépense ?',
        confirmReset: 'Réinitialiser tous les paramètres ?',
        
        // Messages
        welcome: '👋 Bienvenue !',
        welcomeMessage: 'N\'oubliez pas d\'enregistrer vos dépenses chaque jour.',
        settingsApplied: 'Paramètres appliqués avec succès !',
        connected: 'Connecté',
        disconnected: 'Déconnecté',
        
        // Budget
        budgetExceeded: '⚠️ Budget dépassé !',
        budgetExceededMessage: 'Vous avez dépassé votre budget de {amount} €.',
        budgetWarning: '⚠️ Budget presque épuisé',
        budgetWarningMessage: 'Vous avez utilisé {percent}% de votre budget. Il reste {amount} €.',
        dailyReminder: '📝 Rappel quotidien',
        dailyReminderMessage: 'Vous n\'avez pas encore enregistré de dépenses aujourd\'hui.',

        notifications: 'Notifications',
        monthlyBudget: 'Budget mensuel',
        enableNotifications: 'Activer les notifications',
        reminderTime: 'Heure du rappel',
        save: 'Enregistrer',
        welcome: 'Bienvenue !',
        welcomeMessage: 'Configurez vos notifications pour ne rien oublier.',
        preview: 'Aperçu:',
        displayFormat: 'Format d\'affichage',
        spaceFormat: '(espace pour les milliers)',
        commaFormat: '(virgule pour les milliers)',
        noFormat: '(sans séparateur)',
        maximumBudget: 'Budget maximum',
        exceedNotification: 'Notification de dépassement',
        appearance: 'Apparence',
        theme: 'Thème',
        light: 'Clair',
        dark: 'Sombre',
        auto: 'Auto',
        storageLocation: 'Emplacement de stockage',
        localStorage: 'Stockage local',
        localStorageDesc: 'Données sauvegardées uniquement sur cet appareil',
        googleDrive: 'Google Drive',
        googleDriveDesc: 'Synchronisation cloud accessible partout',
        autoMode: 'Mode automatique',
        autoModeDesc: 'Local si hors ligne, Cloud si disponible',
        notConnected: 'Non connecté',
        language: 'Langue / Language',
        autoBackup: 'Sauvegarde automatique',
        enableAutoBackup: 'Activer la sauvegarde automatique',
        backupFrequency: 'Fréquence des sauvegardes',
        daily: 'Tous les jours',
        weekly: 'Toutes les semaines',
        monthly: 'Tous les mois',
        quickActions: 'Actions rapides',
        applySettings: 'Appliquer les paramètres',
        reset: 'Réinitialiser',
        importFromDrive: 'Importer depuis Drive',
        importSuccess: 'Import réussi',
        importError: 'Erreur d\'importation',
        noBackupFound: 'Aucune sauvegarde trouvée',
        importConfirm: '{count} nouvelle(s) dépense(s) trouvée(s). Importer ?',
        importCompleted: '{count} dépense(s) importée(s)',
    },
    
    en: {
        // Menu
        dashboard: 'Dashboard',
        expenses: 'Expenses',
        statistics: 'Statistics',
        settings: 'Settings',
        
        // Header
        searchPlaceholder: 'Search expenses...',
        syncStatus: 'Synced',
        syncing: 'Syncing...',
        offline: 'Offline',
        
        // Statistics
        totalExpenses: 'Total Expenses',
        expenseCount: 'Number of Expenses',
        average: 'Average',
        budgetRemaining: 'Budget Remaining',
        thisMonth: 'This month',
        perExpense: 'Per expense',
        
        // Add form
        addExpense: 'Add Expense',
        expenseName: 'Expense name',
        amount: 'Amount',
        date: 'Date and time',
        addButton: 'Add',
        
        // Filters
        filterByName: 'Filter by name...',
        filterByDate: 'By date',
        filterByMonth: 'By month',
        clearFilters: 'Clear',
        all: 'All',
        today: 'Today',
        thisWeek: 'This week',
        thisMonth: 'This month',
        
        // Expenses list
        recentExpenses: 'Recent Expenses',
        allExpenses: 'All Expenses',
        noExpenses: 'No expenses recorded',
        pending: 'Pending sync',
        
        // Actions
        delete: 'Delete',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        
        // Notifications
        expenseAdded: 'Expense added successfully!',
        expenseDeleted: 'Expense deleted successfully',
        fillAllFields: 'Please fill all fields',
        syncing: 'Syncing...',
        syncSuccess: 'Sync completed!',
        syncError: 'Sync error',
        
        // Settings
        currency: 'Currency',
        language: 'Language',
        french: 'French',
        english: 'English',
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        auto: 'Auto',
        budget: 'Monthly Budget',
        notifications: 'Notifications',
        saveSettings: 'Apply',
        resetSettings: 'Reset',
        
        // Confirmation
        confirmDelete: 'Are you sure you want to delete this expense?',
        confirmReset: 'Reset all settings?',
        
        // Messages
        welcome: '👋 Welcome!',
        welcomeMessage: 'Don\'t forget to record your expenses every day.',
        settingsApplied: 'Settings applied successfully!',
        connected: 'Connected',
        disconnected: 'Disconnected',
        
        // Budget
        budgetExceeded: '⚠️ Budget exceeded!',
        budgetExceededMessage: 'You have exceeded your budget by {amount} €.',
        budgetWarning: '⚠️ Budget almost exhausted',
        budgetWarningMessage: 'You have used {percent}% of your budget. {amount} € remaining.',
        dailyReminder: '📝 Daily reminder',
        dailyReminderMessage: 'You haven\'t recorded any expenses today.',

        notifications: 'Notifications',
        monthlyBudget: 'Monthly budget',
        enableNotifications: 'Enable notifications',
        reminderTime: 'Reminder time',
        save: 'Save',
        welcome: 'Welcome!',
        welcomeMessage: 'Configure your notifications to never miss a thing.',
        preview: 'Preview:',
        displayFormat: 'Display format',
        spaceFormat: '(space for thousands)',
        commaFormat: '(comma for thousands)',
        noFormat: '(no separator)',
        maximumBudget: 'Maximum budget',
        exceedNotification: 'Exceed notification',
        appearance: 'Appearance',
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        auto: 'Auto',
        storageLocation: 'Storage location',
        localStorage: 'Local storage',
        localStorageDesc: 'Data saved only on this device',
        googleDrive: 'Google Drive',
        googleDriveDesc: 'Cloud sync accessible everywhere',
        autoMode: 'Auto mode',
        autoModeDesc: 'Local if offline, Cloud if available',
        notConnected: 'Not connected',
        language: 'Language',
        autoBackup: 'Auto backup',
        enableAutoBackup: 'Enable auto backup',
        backupFrequency: 'Backup frequency',
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        quickActions: 'Quick actions',
        applySettings: 'Apply settings',
        reset: 'Reset',
        importFromDrive: 'Import from Drive',
        importSuccess: 'Import successful',
        importError: 'Import error',
        noBackupFound: 'No backup found',
        importConfirm: '{count} new expense(s) found. Import?',
        importCompleted: '{count} expense(s) imported',
    }
};

class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'fr';
        this.translations = translations;
        this.observers = [];
        
        this.init();
    }
    
    init() {
        // Appliquer la langue au chargement
        this.applyLanguage(this.currentLang);
    }
    
    getText(key, params = {}) {
        let text = this.translations[this.currentLang][key] || this.translations['fr'][key] || key;
        
        // Remplacer les paramètres
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        
        return text;
    }
    
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('language', lang);
            this.applyLanguage(lang);
            this.notifyObservers();
        }
    }
    
    applyLanguage(lang) {
        document.documentElement.setAttribute('lang', lang);
        document.documentElement.setAttribute('dir', 'ltr'); // Pour les langues RTL si besoin
    }
    
    // Observer pattern pour mettre à jour l'UI
    subscribe(observer) {
        this.observers.push(observer);
    }
    
    notifyObservers() {
        this.observers.forEach(observer => observer(this.currentLang));
    }
    
    // Formater les dates selon la langue
    formatDate(date) {
        return new Date(date).toLocaleDateString(this.currentLang === 'fr' ? 'fr-FR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Formater les nombres selon la langue
    formatNumber(number) {
        return new Intl.NumberFormat(this.currentLang === 'fr' ? 'fr-FR' : 'en-US').format(number);
    }
    
    // Formater la monnaie selon la langue
    formatCurrency(amount, currency = 'EUR') {
        return new Intl.NumberFormat(this.currentLang === 'fr' ? 'fr-FR' : 'en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }
}

// Instance globale
window.lang = new LanguageManager();