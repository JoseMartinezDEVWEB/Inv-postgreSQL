const fs = require('fs');
const path = require('path');

const serverFile = path.resolve(__dirname, '../server.js');
let content = fs.readFileSync(serverFile, 'utf8');

const regex = /\{\s*error:\s*(.+?)\s*\}/g;

let matchesCount = 0;
const newContent = content.replace(regex, (match, expression) => {
    matchesCount++;
    return `{ mensaje: ${expression}, error: ${expression} }`;
});

fs.writeFileSync(serverFile, newContent, 'utf8');
console.log(`Reemplazos estandarizados realizados: ${matchesCount}`);
