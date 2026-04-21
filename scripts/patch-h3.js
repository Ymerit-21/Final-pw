const fs = require('fs');
const path = require('path');

const targetFiles = [
    'node_modules/h3-js/dist/browser/h3-js.js',
    'node_modules/h3-js/dist/libh3-browser.js',
    'node_modules/h3-js/dist/h3-js.js',
    'node_modules/h3-js/dist/h3-js.es.js',
    'node_modules/h3-js/dist/h3-js.umd.js'
];

const PATCH_MARKER = '/* PATCHED_FOR_HERMES */';

function patchFile(relativeColor) {
    const fullPath = path.resolve(__dirname, '..', relativeColor);
    if (!fs.existsSync(fullPath)) {
        console.log(`Skipping: ${relativeColor} (not found)`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.includes(PATCH_MARKER)) {
        console.log(`Already patched: ${relativeColor}`);
        return;
    }

    console.log(`Patching: ${relativeColor}...`);
    
    // Replacement for unminified code
    const originalUnminified = /new TextDecoder\("utf-16le"\)/g;
    const replacementUnminified = `(function(){try{return new TextDecoder("utf-16le")}catch(e){return undefined}})() ${PATCH_MARKER}`;
    
    // Replacement for minified code (different patterns)
    const originalMinified = /"undefined"!=?typeof TextDecoder&&new TextDecoder\("utf-16le"\)/g;
    const replacementMinified = `function(){try{return"undefined"!=typeof TextDecoder&&new TextDecoder("utf-16le")}catch(e){return undefined}}() ${PATCH_MARKER}`;

    let newContent = content.replace(originalUnminified, replacementUnminified);
    newContent = newContent.replace(originalMinified, replacementMinified);

    if (content === newContent) {
        // Try fallback for different minification
        newContent = content.replace(/new TextDecoder\('utf-16le'\)/g, replacementUnminified);
    }

    if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Successfully patched: ${relativeColor}`);
    } else {
        console.log(`Warning: Could not find target pattern in ${relativeColor}`);
    }
}

targetFiles.forEach(patchFile);
