// ============================================
// GESTION DU MENU MOBILE
// ============================================

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
                this.overlay.addEventListener('click', () => this.closeMenu());
            }
            
            window.addEventListener('resize', () => this.handleResize());
            
            this.sidebar.addEventListener('click', (e) => e.stopPropagation());
        }
    }
    
    handleResize() {
        if (window.innerWidth > 992) {
            this.sidebar.classList.remove('active');
            this.sidebar.style.transform = '';
            if (this.overlay) this.overlay.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
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
        if (this.overlay) this.overlay.classList.add('active');
        document.body.classList.add('menu-open');
    }
    
    closeMenu() {
        this.sidebar.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    }
}
