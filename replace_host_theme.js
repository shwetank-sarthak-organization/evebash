const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, 'src/app/(main)/host/page.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  { search: /bg-royal-cream/g, replace: 'bg-[#0f172a]' },
  { search: /text-slate-800/g, replace: 'text-slate-200' },
  { search: /text-slate-900/g, replace: 'text-white' },
  { search: /bg-white/g, replace: 'bg-slate-800' },
  { search: /bg-stone-50/g, replace: 'bg-slate-900/50' },
  { search: /border-stone-100/g, replace: 'border-slate-700' },
  { search: /border-stone-200/g, replace: 'border-slate-700' },
  { search: /bg-slate-50/g, replace: 'bg-slate-800' },
  { search: /bg-slate-100/g, replace: 'bg-slate-700' },
  { search: /text-stone-600/g, replace: 'text-slate-400' },
  { search: /text-stone-500/g, replace: 'text-slate-400' },
  { search: /text-stone-800/g, replace: 'text-slate-200' },
  { search: /text-slate-500/g, replace: 'text-slate-400' },
  { search: /text-slate-600/g, replace: 'text-slate-300' },
  { search: /hover:bg-stone-50/g, replace: 'hover:bg-slate-700' },
  { search: /hover:bg-stone-100/g, replace: 'hover:bg-slate-600' },
  { search: /border-stone-50/g, replace: 'border-slate-700' },
  { search: /border-stone-300/g, replace: 'border-slate-600' },
  { search: /bg-royal-gold\/10/g, replace: 'bg-sky-500/10' },
  { search: /bg-royal-gold\/5/g, replace: 'bg-sky-500/5' },
  { search: /text-royal-gold/g, replace: 'text-sky-400' },
  { search: /border-royal-gold/g, replace: 'border-sky-500' },
  { search: /ring-royal-gold/g, replace: 'ring-sky-500' },
  { search: /bg-amber-50/g, replace: 'bg-amber-900/30' },
  { search: /border-amber-100/g, replace: 'border-amber-500/30' },
  { search: /bg-amber-100/g, replace: 'bg-amber-900/50' },
  { search: /text-amber-600/g, replace: 'text-amber-400' },
  { search: /border-amber-200/g, replace: 'border-amber-500/50' },
  { search: /text-amber-700/g, replace: 'text-amber-400' },
];

replacements.forEach(({ search, replace }) => {
  content = content.replace(search, replace);
});

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully updated host/page.tsx tailwind classes!');
