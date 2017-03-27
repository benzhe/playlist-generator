
const file = require('file');
const nodeID3 = require('node-id3');
const mime = require('mime');

const SUPPORT_TYPES = ['audio/mpeg', 'audio/mpeg3', 'audio/x-mpeg-3'];

module.exports = function reader(libraryPath) {
    return new Promise(function(resolve, reject) {
        const mp3List = [];
        file.walkSync(libraryPath, function(err, dirPath, dirs, files) {
            console.log(arguments);
            // if(err) reject(err);
            // files.forEach((file) => {
            //     const type = mime.lookup(file);
            //     if (~SUPPORT_TYPES.indexOf(type)) {
            //         mp3List.push(file);
            //     }
            // });
        });
        return mp3List;
    });
}


