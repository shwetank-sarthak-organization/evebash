const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/app/(public)/pricing/page.tsx',
  'src/app/(public)/contact-us/page.tsx',
  'src/app/(main)/biz-hub/page.tsx',
  'src/app/(main)/marketplace/page.tsx'
].map(file => path.resolve(__dirname, file));

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
  { search: /bg-royal-gold\/20/g, replace: 'bg-sky-500/20' },
  { search: /bg-royal-gold\/5/g, replace: 'bg-sky-500/5' },
  { search: /bg-royal-gold\/30/g, replace: 'bg-sky-500/30' },
  { search: /text-royal-gold/g, replace: 'text-sky-400' },
  { search: /border-royal-gold/g, replace: 'border-sky-500' },
  { search: /ring-royal-gold/g, replace: 'ring-sky-500' },
  { search: /bg-amber-50/g, replace: 'bg-amber-900/30' },
  { search: /border-amber-100/g, replace: 'border-amber-500/30' },
  { search: /bg-amber-100/g, replace: 'bg-amber-900/50' },
  { search: /text-amber-600/g, replace: 'text-amber-400' },
  { search: /border-amber-200/g, replace: 'border-amber-500/50' },
  { search: /text-amber-700/g, replace: 'text-amber-400' },
  { search: /bg-rose-50/g, replace: 'bg-rose-900/30' },
  { search: /text-rose-600/g, replace: 'text-rose-400' },
  { search: /border-rose-100/g, replace: 'border-rose-500/30' },
  { search: /bg-purple-50/g, replace: 'bg-purple-900/30' },
  { search: /text-purple-600/g, replace: 'text-purple-400' },
  { search: /border-purple-100/g, replace: 'border-purple-500/30' },
  { search: /bg-sky-50/g, replace: 'bg-sky-900/30' },
  { search: /text-sky-600/g, replace: 'text-sky-400' },
  { search: /border-sky-100/g, replace: 'border-sky-500/30' },
  { search: /bg-teal-50/g, replace: 'bg-teal-900/30' },
  { search: /text-teal-600/g, replace: 'text-teal-400' },
  { search: /border-teal-100/g, replace: 'border-teal-500/30' },
  { search: /bg-emerald-50/g, replace: 'bg-emerald-900/30' },
  { search: /text-emerald-600/g, replace: 'text-emerald-400' },
  { search: /text-emerald-500/g, replace: 'text-emerald-400' },
  { search: /border-emerald-100/g, replace: 'border-emerald-500/30' },
  { search: /bg-stone-100/g, replace: 'bg-slate-700' },
  { search: /bg-stone-200/g, replace: 'bg-slate-600' },
  { search: /text-stone-400/g, replace: 'text-slate-500' },
];

targetFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    replacements.forEach(({ search, replace }) => {
      content = content.replace(search, replace);
    });
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Successfully updated ${path.basename(path.dirname(file))}/page.tsx tailwind classes!`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
