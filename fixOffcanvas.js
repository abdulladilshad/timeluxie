const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'views', 'user');

if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ejs'));
    for (const file of files) {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        let original = content;

        // 1. Remove inline styles
        content = content.replace(/ style="background-color: var\(--dark\); color: var\(--light-bg\);"/g, '');
        content = content.replace(/ style="filter: invert\(1\) grayscale\(100%\) brightness\(200%\);"/g, '');

        // 2. Remove the comment
        content = content.replace(/\/\*\s*Mobile Offcanvas Overrides\s*\*\//g, '');

        // 3. Remove .offcanvas { ... }
        content = content.replace(/[ \t]*\.offcanvas\s*\{\s*background-color[^}]+\}\r?\n?/g, '');

        // 4. Remove .offcanvas .btn-close { ... }
        content = content.replace(/[ \t]*\.offcanvas \.btn-close\s*\{\s*filter:[^}]+\}\r?\n?/g, '');

        // 5. Remove .offcanvas a { ... }
        content = content.replace(/[ \t]*\.offcanvas a\s*\{\s*(color|font-family)[^}]+\}\r?\n?/g, '');

        // 6. Remove .offcanvas a:hover { ... }
        content = content.replace(/[ \t]*\.offcanvas a:hover\s*\{\s*color[^}]+\}\r?\n?/g, '');
        
        // Remove .offcanvas-body > a just in case (seen in some files)
        content = content.replace(/[ \t]*\.offcanvas-body > a\s*\{\s*(color|font-family)[^}]+\}\r?\n?/g, '');


        if (original !== content) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${file}`);
        }
    }
} else {
    console.log("Directory not found:", dir);
}
