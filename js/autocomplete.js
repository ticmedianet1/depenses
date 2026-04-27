// ============================================
// AUTOCOMPLÉTION DES NOMS DE DÉPENSES
// ============================================

class ExpenseAutocomplete {
    constructor(inputElement) {
        this.input = inputElement;
        this.container = null;
        this.suggestions = [];
        this.allExpenses = [];
        this.debounceTimer = null;
        this.suppressSuggestions = false;
        this.suppressTimer = null;
        this.currencySymbol = this.getCurrencySymbol();
        
        this.init();
    }

    init() {
        this.createContainer();
        this.loadExpenses();
        this.attachEvents();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'suggestions-container';
        this.input.parentNode.style.position = 'relative';
        this.input.parentNode.appendChild(this.container);
    }

    async loadExpenses() {
        if (!window.app || !window.app.db) return;
        this.allExpenses = await window.app.db.getAllExpenses();
    }

    getCurrencySymbol() {
        const currency = localStorage.getItem('currency') || 'XOF';
        const symbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CNY': '¥',
            'XOF': 'FCFA', 'XAF': 'FCFA', 'MAD': 'MAD', 'DZD': 'DA', 'TND': 'DT',
            'NGN': '₦', 'ZAR': 'R', 'BRL': 'R$', 'RUB': '₽', 'INR': '₹', 'AUD': 'A$'
        };
        return symbols[currency] || 'FCFA';
    }

    attachEvents() {
        // Écouter la saisie
        this.input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            
            // Ne pas montrer les suggestions si elles sont supprimées
            if (this.suppressSuggestions) return;
            
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.showSuggestions(value);
            }, 300);
        });

        // Cacher les suggestions au clic ailleurs
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target) && e.target !== this.input) {
                this.container.classList.remove('active');
            }
        });

        // Empêcher la fermeture au clic sur le container
        this.container.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Navigation au clavier
        this.input.addEventListener('keydown', (e) => {
            if (!this.container.classList.contains('active')) return;
            
            const items = this.container.querySelectorAll('.suggestion-item');
            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectNext(items, currentIndex);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectPrevious(items, currentIndex);
                    break;
                case 'Enter':
                    e.preventDefault();
                    const selected = this.container.querySelector('.suggestion-item.selected');
                    if (selected) {
                        this.applySuggestion(selected.dataset.name);
                    }
                    break;
                case 'Escape':
                    this.container.classList.remove('active');
                    break;
            }
        });
    }

    showSuggestions(searchTerm) {
        if (searchTerm.length < 2) {
            this.container.classList.remove('active');
            return;
        }
        
        // Éviter de montrer les suggestions si le délai est actif
        if (this.suppressSuggestions) {
            return;
        }
        
        // Recharger les données si nécessaire
        this.loadExpenses().then(() => {
            const nameStats = this.analyzeExpenseNames();
            
            let suggestions = nameStats
                .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a, b) => {
                    const aExact = a.name.toLowerCase().startsWith(searchTerm.toLowerCase());
                    const bExact = b.name.toLowerCase().startsWith(searchTerm.toLowerCase());
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    return b.count - a.count;
                })
                .slice(0, 8);

            if (suggestions.length === 0) {
                this.container.classList.remove('active');
                return;
            }

            this.renderSuggestions(suggestions, searchTerm);
            this.container.classList.add('active');
        });
    }

    analyzeExpenseNames() {
        const stats = new Map();
        
        this.allExpenses.forEach(expense => {
            const name = expense.name;
            if (!stats.has(name)) {
                stats.set(name, {
                    name: name,
                    count: 1,
                    total: expense.amount,
                    lastUsed: new Date(expense.date)
                });
            } else {
                const item = stats.get(name);
                item.count++;
                item.total += expense.amount;
                if (new Date(expense.date) > new Date(item.lastUsed)) {
                    item.lastUsed = new Date(expense.date);
                }
            }
        });

        return Array.from(stats.values());
    }

    renderSuggestions(suggestions, searchTerm) {
        this.container.innerHTML = suggestions.map(item => {
            const average = (item.total / item.count).toFixed(2);
            const lastUsed = new Date(item.lastUsed).toLocaleDateString('fr-FR');
            const highlightedName = this.highlightMatch(item.name, searchTerm);
            
            return `
                <div class="suggestion-item" data-name="${item.name}">
                    <span class="material-icons">history</span>
                    <div class="suggestion-content">
                        <div class="suggestion-name">${highlightedName}</div>
                        <div class="suggestion-stats">
                            <span><span class="material-icons">repeat</span> ${item.count}x</span>
                            <span><span class="material-icons">euro</span> ${average} €</span>
                            <span><span class="material-icons">schedule</span> ${lastUsed}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applySuggestion(item.dataset.name);
            });
        });
    }

    highlightMatch(text, searchTerm) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="suggestion-highlight">$1</span>');
    }

    applySuggestion(name) {
        // Désactiver temporairement les suggestions
        this.suppressSuggestions = true;
        
        this.input.value = name;
        this.container.classList.remove('active');
        
        // Déclencher les événements
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Réactiver les suggestions après 500ms
        if (this.suppressTimer) clearTimeout(this.suppressTimer);
        this.suppressTimer = setTimeout(() => {
            this.suppressSuggestions = false;
        }, 500);
    }

    selectNext(items, currentIndex) {
        if (items.length === 0) return;
        
        items.forEach(item => item.classList.remove('selected'));
        
        let nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) nextIndex = 0;
        
        items[nextIndex].classList.add('selected');
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    }

    selectPrevious(items, currentIndex) {
        if (items.length === 0) return;
        
        items.forEach(item => item.classList.remove('selected'));
        
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = items.length - 1;
        
        items[prevIndex].classList.add('selected');
        items[prevIndex].scrollIntoView({ block: 'nearest' });
    }
}
