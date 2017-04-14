const fs = require('fs');
const path = require('path');

module.exports = function (collections, output) {
    collections.forEach((collection) => {
        const name = collection.name;
        const filepath = path.resolve(output, name + '.pls');
        let content = '[playlist]\n\n';
        content += `NumberOfEntries=${collection.list.length}\n\n`;
        collection.list.forEach((song, index) => {
            if (song.path) {
                const relative = path.relative(output, song.path);
                content += `File${index + 1}=${relative}\n\n`;
            }
        });
        fs.writeFileSync(filepath, content, { encoding: 'UTF-8' });
        console.log(`Writing ${filepath}`);
    });
}
