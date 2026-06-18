const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');
const newIP = '192.168.0.115';
const oldIP1 = '192.168.0.103';
const oldIP2 = '192.168.2.119'; // from api.js comments

function fixIPs(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixIPs(fullPath);
        } else if (fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = false;
            
            if (content.includes(oldIP1)) {
                content = content.replace(new RegExp(oldIP1, 'g'), newIP);
                updated = true;
            }
            if (content.includes('127.0.0.1')) {
                // Wait, if it's getImageUrl, it replaces 127.0.0.1, we don't need to change that string,
                // but we should check if they hardcoded 127.0.0.1 as the replacement
            }
            
            if (updated) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated IPs in ${file}`);
            }
        }
    }
}

fixIPs(screensDir);

// Also fix api.js
const apiPath = path.join(__dirname, 'api.js');
let apiContent = fs.readFileSync(apiPath, 'utf8');
apiContent = apiContent.replace(/127\.0\.0\.1/g, newIP); // Change API_URL to use newIP
apiContent = apiContent.replace(new RegExp(oldIP1, 'g'), newIP);
fs.writeFileSync(apiPath, apiContent);
console.log('Updated api.js');
