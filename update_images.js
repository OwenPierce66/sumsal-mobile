const fs = require('fs');
const path = require('path');
const screensDir = path.join(__dirname, 'screens');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // We only care if Image is imported from react-native
      if (content.match(/import\s+{[^}]*Image[^}]*}\s+from\s+['"]react-native['"]/)) {
        
        // Remove Image from react-native imports
        content = content.replace(/(import\s+{[^}]*)(\bImage\b\s*,?\s*)([^}]*}\s+from\s+['"]react-native['"])/g, '$1$3');
        // Clean up possible empty commas like { , Text } -> { Text }, { } -> {}
        content = content.replace(/{\s*,\s*/g, '{ ').replace(/,\s*}/g, ' }').replace(/,\s*,/g, ',');
        
        if (!content.includes("from 'expo-image'") && !content.includes('from "expo-image"')) {
          // Find the last import statement
          const lines = content.split('\n');
          let lastImportIndex = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
              lastImportIndex = i;
            }
          }
          lines.splice(lastImportIndex + 1, 0, "import { Image } from 'expo-image';");
          content = lines.join('\n');
        }
        
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + file);
      }
    }
  }
}
processDir(screensDir);
