const fs = require('fs');

const content = fs.readFileSync('apps/mobile/constants/templates.ts', 'utf8');

// We can just use a regex to extract the MOBILE_TEMPLATE_THEMES block
const match = content.match(/export const MOBILE_TEMPLATE_THEMES: TemplateTheme\[\] = (\[[\s\S]*?\]);/);
if (match) {
    let arrayStr = match[1];
    
    // Evaluate the array string to a JS object
    // Need to handle missing quotes on keys. Since it's TS, eval might fail on type annotations, but here it's just an array of objects.
    // Let's strip out 'useSerif: true' and comments to be safe.
    
    // Better: let's just write a script that transpiles it or we can just use simple regex replacement.
    
    console.log("Found it!");
}
