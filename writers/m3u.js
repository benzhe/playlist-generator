const fs = require('fs');
const path = require('path');
const m3u = require('m3u'); 

function escapeSemicolon(str) {
    return str.replace(/;/g, '%3B');
}

module.exports = function (collections, output) {
    collections.forEach((collection) => {
        const name = collection.name;
        const filepath = path.resolve(output, name + '.m3u8');
        const writer = m3u.extendedWriter();
        collection.list.forEach((song) => {
            if (song.path) {
                const relative = path.relative(output, song.path);
                const artists = escapeSemicolon(song.artists.join('/'));
                const songname = escapeSemicolon(song.name);
                writer.file(relative, -1, `${artists} - ${songname}`);
            }
        });
        fs.writeFileSync(filepath, writer.toString(), { encoding: 'UTF-8' });
        console.log(`Writing ${filepath}`);
    });
}