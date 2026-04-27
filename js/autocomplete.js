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
        
        this.init();
    }

    init() {
        // Créer le conteneur de suggestions
        this.createContainer();
        
        // Charger les données initiales
        this.loadExpenses();
        
        // Écouter les événements
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
        
        // Récupérer toutes les dépenses du compte courant
        this.allExpenses = await window.app.db.getAllExpenses();
    }

    attachEvents() {
        // Écouter la saisie
        this.input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            
            // Débounce pour éviter trop de calculs
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

    async showSuggestions(searchTerm) {
        if (searchTerm.length < 2) {
            this.container.classList.remove('active');
            return;
        }

        // Recharger les données si nécessaire
        await this.loadExpenses();

        // Analyser les noms de dépenses
        const nameStats = this.analyzeExpenseNames();
        
        // Filtrer les suggestions
        let suggestions = nameStats
            .filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                // Priorité aux correspondances exactes
                const aExact = a.name.toLowerCase().startsWith(searchTerm.toLowerCase());
                const bExact = b.name.toLowerCase().startsWith(searchTerm.toLowerCase());
                
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // Puis par fréquence d'utilisation
                return b.count - a.count;
            })
            .slice(0, 8); // Limiter à 8 suggestions

        if (suggestions.length === 0) {
            this.container.classList.remove('active');
            return;
        }

        this.renderSuggestions(suggestions, searchTerm);
        this.container.classList.add('active');
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
            
            // Mettre en évidence le terme recherché
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

        // Ajouter les événements de clic
        this.container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                this.applySuggestion(item.dataset.name);
            });
        });
    }

    highlightMatch(text, searchTerm) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="suggestion-highlight">$1</span>');
    }

    applySuggestion(name) {
        this.input.value = name;
        this.container.classList.remove('active');
        this.input.blur(); // ← Perd le focus pour éviter la réouverture
        
        // Déclencher un événement input pour validation
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Déclencher un événement change pour sauvegarder
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
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
