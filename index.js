#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const program = require('commander');
const mm = require('musicmetadata');
const pqueue = require('p-queue');
const recursive = require('recursive-readdir');
const progress = require('progress');
const Fuse = require('fuse.js');
const packageInfo = require('./package');
const { convertToTran, convertToSimp } = require('./utils/chn');

const UNSUPPORTED_TYPES = ['!*.mp3'];

program
    .version(packageInfo.version)
    .option('-l, --library [value]', 'Local library path')
    .option('-a, --adaptor [value]', 'Adaptor module path')
    .option('-o, --output [value]', 'Output path')
    .option('--pls [value]', 'Generate pls instead of m3u')
    .option('--wpl [value]', 'Generate wpl instead of m3u')
    .option('-g, --generate', 'Generate library detail list in cvs format')
    .parse(process.argv);


const library = path.resolve('.', program.library);
const output = path.resolve('.', program.output);

const reader = new Promise(function (resolve, reject) {
    recursive(library, UNSUPPORTED_TYPES, function (err, files) {
        if (err) reject(err);
        resolve(files);
    });
});

const list = [];
let listfile = '';

function parseMeta(metadata) {
    let artist = metadata.artist;
    if (artist) {
        let reset = [];
        artist.forEach(function (members) {
            members = members + '/';
            let ms = members.match(/(.+?)[，;\/]/ig);
            ms = ms.map(function (member) {
                return member
                    .replace(/，/g, '')
                    .replace(/;/g, '')
                    .replace(/\//g, '')
                    .trim();
            });
            reset = reset.concat(ms);
        });
        metadata.artist = reset;
    }
    let title = metadata.title;
    if (title) {
        metadata.titleSimp = convertToSimp(title);
    }
}

function listInCollectionNormal(songs, collections) {
    const res =[];
    collections.forEach((collection) => {
        const co = {
            name: collection.name,
            list: []
        };
        // if(co.name !== '杨千嬅') return;
        const listInCollection = collection.list;
        listInCollection.forEach((_s) => {
            const bool = songs.some((song) => {
                const isSameName = 
                    song.metadata.title.trim() === _s.name.trim() ||
                    convertToSimp(song.metadata.title.trim()) === _s.name.trim();
                console.log('NAME:', song.metadata.title, _s.name.trim(), convertToSimp(song.metadata.title.trim()))
                if (
                    isSameName &&
                    _.intersection(song.metadata.artist, _s.artists).length
                ) {
                    co.list.push({
                        path: song.file,
                        name: song.metadata.title,
                        artists: _s.artists
                    });
                    return true;
                }
                else return false;
            });
            if (!bool) co.list.push({
                name: _s.name,
                artists: _s.artists,
                missing: true
            });
        });
        res.push(co);
    });
    return res;
}

function fuseSearch(list, matchName, matchArtist) {
    const options = {
        // isCaseSensitive: false,
        // includeScore: false,
        // shouldSort: true,
        // includeMatches: false,
        // findAllMatches: false,
        // minMatchCharLength: 1,
        // location: 0,
        // threshold: 0.6,
        // distance: 100,
        // useExtendedSearch: false,
        // ignoreLocation: false,
        // ignoreFieldNorm: false,
        keys: [
          "metadata.title",
          "metadata.titleSimp"
        ]
      };
    
      const fuse = new Fuse(list, options);
      let res = fuse.search(matchName);
      // match name first, then artists
      if (res && res.length) {
        res = res.filter((songItem) => {
            // TODO: Optimizable, should using maximum intersection's song
            const matched = _.intersection(songItem.item.metadata.artist, matchArtist).length;
            return matched;
        });
      }
      if (res[0]) {
          return res[0].item;
      }
      return null;
}

function listInCollectionFuse(songs, collections) {

    const res =[];
    collections.forEach((collection) => {
        const co = {
            name: collection.name,
            list: []
        };
        // if(co.name !== '杨千嬅') return;
        const listInCollection = collection.list;
        listInCollection.forEach((_s) => {
            const collectionSongName = _s.name.trim();
            const collectionSongArtist = _s.artists;
            const result = fuseSearch(songs, collectionSongName, collectionSongArtist);
            if (result) {
                co.list.push({
                    path: result.file,
                    name: result.metadata.title,
                    artists: _s.artists
                });
            }
            else {
                co.list.push({
                    name: _s.name,
                    artists: _s.artists,
                    missing: true
                });
            }
        });
        res.push(co);
    });
    return res;

}

reader.then(function (files) {
    console.log(`All files count: ${files.length}`)
    const bar = new progress('Scaning :percent [:bar]', { total: files.length });
    const queue = new pqueue({ concurrency: 1 });
    files.forEach(function (file) {
        queue.add(() => new Promise(function (resolve, reject) {
            const readableStream = fs.createReadStream(file);
            const parser = mm(readableStream, function (err, metadata) {
                if (err) console.log(file, err);
                else {
                    parseMeta(metadata);
                    list.push({
                        file,
                        metadata
                    });
                    readableStream.close();
                    listfile += `${file},${_.values(metadata).join(',')}\r\n`;
                }
                bar.tick();
                resolve();
            });
        }));
    });
    return queue.onEmpty();
}).then(function () {
    console.log('Available files count:', list.length);
    if(program.generate) 
        fs.writeFileSync(path.resolve(output, 'list.csv'), listfile, { encoding: 'UTF-8' });
    const adaptor = require(program.adaptor);
    return adaptor();
}).then(function (collections) {
    console.log(`Total ${collections.length} available collection`);
    const songs = list;
    const res = listInCollectionFuse(songs, collections);
    return res;
}).then(function (collections) {
    return collections.filter((collection) => {
        const failList = [];
        let successCount = 0;
        console.log(`Matching ${collection.name}...`);
        let resFile = '';
        collection.list = collection.list.filter((song) => {
            if (!song.path) {
                console.log(`    Missing: ${song.artists.join('/')} - ${song.name}`);
                resFile += `${collection.name},${song.name},${song.artists.join('/')},Missing\n`;
                return false;
            }
            else {
                successCount++;
                resFile += `${collection.name},${song.name},${song.artists.join('/')},${song.path}\n`;
                return true;
            }
        });
        if(program.generate) 
            fs.writeFileSync(path.resolve(output, 'result.csv'), resFile, { encoding: 'UTF-8' });
        return successCount;
    });
}).then(function (collections) {
    if (program.pls) {
        require('./writers/pls')(collections, output);
    }
    else if (program.wpl) {
        require('./writers/wpl')(collections, output);
    }
    else {
        require('./writers/m3u')(collections, output);
    }
});

