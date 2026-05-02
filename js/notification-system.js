// ============================================
// SYSTÈME DE NOTIFICATIONS
// ============================================

class NotificationSystem {
    constructor() {
        this.budget = parseFloat(localStorage.getItem('budget')) || 1000;
        this.notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
        this.reminderTime = localStorage.getItem('reminderTime') || '20:00';
        this.lastNotificationDate = localStorage.getItem('lastNotificationDate') || null;
        this.waitForDB();
    }
    
    waitForDB() {
        if (window.app && window.app.db && window.app.db.db) {
            this.init();
        } else {
            setTimeout(() => this.waitForDB(), 200);
        }
    }
    
    init() {
        console.log('📊 Système de notifications initialisé');
        this.requestPermission();
        this.checkBudget();
        this.scheduleDailyReminder();
        setInterval(() => this.checkBudget(), 60 * 60 * 1000);
    }
    
    async requestPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }
    
    async showNotification(title, options = {}) {
        if (!this.notificationsEnabled || Notification.permission !== 'granted') return false;
        
        try {
            const notification = new Notification(title, {
                icon: '/icons/image.png',
                vibrate: [200, 100, 200],
                requireInteraction: true,
                ...options
            });
            notification.onclick = () => { window.focus(); notification.close(); };
            return notification;
        } catch (error) {
            console.error('Erreur notification:', error);
            return false;
        }
    }
    
    async checkBudget() {
        if (!window.app?.db) return;
        
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
            
            if (remaining < 0) {
                this.showNotification('⚠️ Budget dépassé !', {
                    body: `Dépassement de ${Math.abs(remaining).toFixed(2)} FCFA`
                });
            } else if (percentageUsed >= 90) {
                this.showNotification('⚠️ Budget presque épuisé', {
                    body: `${percentageUsed.toFixed(0)}% utilisé, reste ${remaining.toFixed(2)} FCFA`
                });
            }
        } catch (error) {
            console.error('Erreur vérification budget:', error);
        }
    }
    
    scheduleDailyReminder() {
        setInterval(() => this.checkDailyReminder(), 60 * 1000);
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
                    body: 'Vous n\'avez pas encore enregistré de dépenses aujourd\'hui.'
                });
                this.lastNotificationDate = today;
                localStorage.setItem('lastNotificationDate', today);
            }
        });
    }
    
    async checkTodayExpenses() {
        if (!window.app?.db) return false;
        const expenses = await window.app.db.getAllExpenses();
        const today = new Date().toDateString();
        return expenses.some(e => new Date(e.date).toDateString() === today);
    }
    
    updateSettings(budget, enabled, time) {
        this.budget = budget;
        this.notificationsEnabled = enabled;
        this.reminderTime = time;
        localStorage.setItem('budget', budget);
        localStorage.setItem('notificationsEnabled', enabled);
        localStorage.setItem('reminderTime', time);
    }
}

function addNotificationButton() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    
    if (document.getElementById('notificationBtn')) return;
    
    const notifBtn = document.createElement('button');
    notifBtn.className = 'btn-icon notification-btn';
    notifBtn.id = 'notificationBtn';
    notifBtn.innerHTML = '<span class="material-icons">notifications</span>';
    notifBtn.title = 'Notifications';
    headerActions.appendChild(notifBtn);
    
    notifBtn.addEventListener('click', () => {
        if (window.notificationSystem) {
            const budget = prompt('Budget mensuel (FCFA):', localStorage.getItem('budget') || 1000);
            if (budget) {
                window.notificationSystem.updateSettings(parseFloat(budget), true, '20:00');
                alert('Paramètres sauvegardés');
            }
        }
    });
}
