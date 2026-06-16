const fs = require('fs');

const pageContent = fs.readFileSync('src/app/(main)/host/page.tsx', 'utf8');
const templatesContent = fs.readFileSync('templates_str.txt', 'utf8');

const updatedContent = pageContent.replace(/export const TEMPLATE_THEMES = \[\s*\/\/ WEDDING[\s\S]*?\];/g, templatesContent);

fs.writeFileSync('src/app/(main)/host/page.tsx', updatedContent);
console.log("Updated!");
