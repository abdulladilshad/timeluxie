const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views', 'user');

const newCSS = `
    /* Search Input Overlay - Glassmorphism Luxury */
    .search-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(10, 10, 10, 0.4);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      z-index: 1100;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }

    .search-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .search-container {
      display: flex;
      align-items: center;
      width: 90%;
      max-width: 800px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      padding: 20px 30px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      transform: translateY(-30px);
      transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    .search-overlay.active .search-container {
      transform: translateY(0);
    }

    .search-icon-large {
      color: var(--gold, #d4af37);
      font-size: 1.5rem;
      margin-right: 20px;
    }

    .search-box-large {
      flex: 1;
      border: none;
      background: transparent;
      color: #ffffff;
      font-size: 1.8rem;
      outline: none;
      font-family: 'Marcellus', var(--font-sans, sans-serif);
      font-weight: 300;
      letter-spacing: 1px;
    }

    .search-box-large::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .ai-search-icon {
      color: rgba(255, 255, 255, 0.5);
      font-size: 1.5rem;
      margin-left: 15px;
      cursor: pointer;
      transition: color 0.3s;
    }

    .ai-search-icon:hover {
      color: var(--gold, #d4af37);
    }

    .close-search {
      color: rgba(255, 255, 255, 0.5);
      font-size: 1.8rem;
      cursor: pointer;
      margin-left: 20px;
      transition: color 0.3s, transform 0.3s;
    }

    .close-search:hover {
      color: #ffffff;
      transform: rotate(90deg);
    }

    @media (max-width: 768px) {
      .search-container {
        width: 95%;
        padding: 15px 20px;
        border-radius: 16px;
      }
      .search-box-large {
        font-size: 1.2rem;
      }
      .search-icon-large, .ai-search-icon, .close-search {
        font-size: 1.2rem;
        margin-right: 10px;
        margin-left: 10px;
      }
    }
`;

const newHTML = `
    <!-- Search Overlay - Glassmorphism -->
    <div class="search-overlay" id="searchOverlay">
        <div class="search-container">
            <i class="fa-solid fa-magnifying-glass search-icon-large"></i>
            <input type="text" id="mainSearch" class="search-box-large" placeholder="Search references, models, or calibers...">
            <i class="fa-solid fa-camera ai-search-icon" title="AI Image Search"></i>
            <i class="fa-solid fa-xmark close-search" onclick="document.getElementById('searchOverlay').classList.remove('active');"></i>
        </div>
    </div>
`;

const newJS = `
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const mainSearch = document.getElementById('mainSearch');
            if (mainSearch && !window.location.pathname.includes('/shope')) {
                mainSearch.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const query = this.value.trim();
                        if (query) {
                            window.location.href = '/shope?search=' + encodeURIComponent(query);
                        }
                    }
                });
            }
        });
    </script>
`;

function processFiles() {
    const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.ejs') && f !== 'shope.ejs');

    files.forEach(file => {
        const filePath = path.join(viewsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // 1. Replace CSS
        // It typically starts with /* Search Input Overlay */ and ends with .close-search:hover { ... }
        const cssRegex = /\/\* Search Input Overlay \*\/[\s\S]*?\.close-search:hover\s*{[^}]*}/;
        if (cssRegex.test(content)) {
            content = content.replace(cssRegex, newCSS.trim());
            modified = true;
        }

        // 2. Replace HTML
        // Starts with <!-- Search Overlay --> and ends with <div class="search-overlay"... </div></div>
        const htmlRegex = /<!-- Search Overlay -->\s*<div class="search-overlay" id="searchOverlay">[\s\S]*?<\/div>\s*<\/div>/;
        if (htmlRegex.test(content)) {
            content = content.replace(htmlRegex, newHTML.trim());
            modified = true;
        }

        // 3. Inject JS if we replaced HTML but JS doesn't exist
        if (modified && !content.includes("window.location.href = '/shope?search='")) {
            // insert before closing body
            content = content.replace(/<\/body>/, newJS.trim() + '\n</body>');
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Updated:', file);
        }
    });
}

processFiles();
console.log('Done');
