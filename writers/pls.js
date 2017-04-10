const fs = require('fs');
const path = require('path');
const m3u = require('m3u'); 

function escapeSemicolon(str) {
    return str.replace(/;/g, '%3B');
}

module.exports = function (collections, output) {
    collections.forEach((collection) => {
        const name = collection.name;
        const filepath = path.resolve(output, name + '.pls');
        let content = '[playlist]\r\r';
        content += `NumberOfEntries=${collection.list.length}\r`
        collection.list.forEach((song, index) => {
            if (song.path) {
                const relative = path.relative(output, song.path);
                // File1=../../Music/中文/纣王老胡/昨天/纣王老胡 - 涩.mp3
                content += `File${index + 1}=${relative}\r`;
            }
        });
        fs.writeFileSync(filepath, content, { encoding: 'UTF-8' });
        console.log(`Writing ${filepath}`);
    });
}