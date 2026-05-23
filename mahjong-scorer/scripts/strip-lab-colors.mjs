#!/usr/bin/env node
/**
 * Post-build CSS sanitizer for Android WebView compatibility.
 *
 * Tailwind v4 outputs colors in lab() / color-mix(in oklab) which
 * render differently in Android WebView vs desktop Chrome.
 *
 * This script processes the built CSS to:
 * 1. Remove lab() declarations when a hex fallback exists
 * 2. Remove @supports(color:lab(...)) blocks (the hex fallback is sufficient)
 * 3. Remove @supports(color:color-mix(in lab,...)) blocks
 * 4. Remove @supports(color:color-mix(in oklab,...)) blocks
 * 5. Remove @supports(color:color-mix(in srgb,...)) blocks
 * 6. Strip inline color-mix() declarations when a hex/rgba fallback exists
 * 7. Strip "in oklab" / "in lab" / "in srgb" from gradient interpolation
 *
 * Run after `next build`: node scripts/strip-lab-colors.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'out');

function findCssFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findCssFiles(full));
    } else if (entry.endsWith('.css')) {
      results.push(full);
    }
  }
  return results;
}

function stripLabColors(css) {
  let modified = css;

  // 1. Remove @supports (color:lab(...)){...} blocks entirely
  //    These wrap lab() color overrides. The hex fallback (outside @supports) is sufficient.
  modified = modified.replace(
    /@supports\s*\(color:\s*lab\([^)]*\)\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    ''
  );

  // 2. Remove @supports (color:color-mix(in lab,...)){...} blocks
  //    These wrap color-mix(in oklab,...) overrides for opacity.
  modified = modified.replace(
    /@supports\s*\(color:\s*color-mix\(in\s+lab[^)]*\)\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    ''
  );

  // 2b. Remove @supports (color:color-mix(in oklab,...)){...} blocks
  modified = modified.replace(
    /@supports\s*\(color:\s*color-mix\(in\s+oklab[^)]*\)\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    ''
  );

  // 2c. Remove @supports (color:color-mix(in srgb,...)){...} blocks
  modified = modified.replace(
    /@supports\s*\(color:\s*color-mix\(in\s+srgb[^)]*\)\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    ''
  );

  // 3. Remove standalone lab() declarations when preceded by hex
  //    Pattern: property: #hexval; property: lab(...)
  modified = modified.replace(
    /([a-z-]+:\s*#[0-9a-fA-F]{6,8})\s*;\s*\1[^;]*lab\([^)]+\)/g,
    '$1'
  );

  // 4. Clean up any remaining inline lab() values that have hex siblings
  //    background-color:#aabbcc33;background-color:lab(...)
  modified = modified.replace(
    /((?:background-color|color|border-color|outline-color|fill|stroke|box-shadow|text-decoration-color|accent-color|caret-color):)\s*#([0-9a-fA-F]{6,8})\s*;\s*\1\s*lab\([^)]+\)/g,
    '$1#$2'
  );

  // 5. Clean up inline color-mix() declarations that have hex/rgba siblings
  //    property:#hex;property:color-mix(in oklab,...) → keep only the hex
  const colorProps = 'background-color|color|border-color|outline-color|fill|stroke|box-shadow|text-decoration-color|accent-color|caret-color|background|border';
  const colorMixInline = new RegExp(
    `((?:${colorProps}):\\s*(?:#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\)))\\s*;\\s*(?:${colorProps}):\\s*color-mix\\([^;]+?\\)`,
    'g'
  );
  modified = modified.replace(colorMixInline, '$1');

  // 6. Strip "in oklab", "in lab", "in srgb" from gradient interpolation.
  //    Tailwind v4 emits e.g. "to right in oklab" which Android WebView
  //    doesn't support, causing the entire gradient to be ignored.
  modified = modified.replace(/\bin\s+oklab\b/g, '');
  modified = modified.replace(/\bin\s+lab\b/g, '');
  modified = modified.replace(/\bin\s+srgb\b/g, '');

  return modified;
}

const cssFiles = findCssFiles(OUT_DIR);
let totalStripped = 0;

for (const file of cssFiles) {
  const original = readFileSync(file, 'utf-8');
  const cleaned = stripLabColors(original);

  if (cleaned !== original) {
    writeFileSync(file, cleaned, 'utf-8');
    const saved = original.length - cleaned.length;
    totalStripped += saved;
    console.log(`✔ ${file.replace(process.cwd() + '/', '')} — stripped ${saved} bytes of lab()/color-mix`);
  }
}

if (totalStripped > 0) {
  console.log(`\n✅ Total: removed ${totalStripped} bytes of lab()/color-mix/oklab CSS for Android WebView compatibility`);
} else {
  console.log('ℹ No lab()/color-mix colors found to strip');
}

