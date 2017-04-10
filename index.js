#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const program = require('commander');
const mm = require('musicmetadata');
const pqueue = require('p-queue');
const recursive = require('recursive-readdir');
const progress = require('progress');
const packageInfo = require('./package');

const UNSUPPORTED_TYPES = ['!*.mp3'];

program
    .version(packageInfo.version)
    .option('-l, --library [value]', 'Local library path')
    .option('-a, --adaptor [value]', 'Adaptor module path')
    .option('-o, --output [value]', 'Output path')
    .option('--pls [value]', 'Generate pls instead of m3u')
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
    if(program.generate) fs.writeFileSync('list.csv', listfile, { encoding: 'UTF-8' });
    const adaptor = require(program.adaptor);
    return adaptor();
}).then(function (collections) {
    console.log(`Total ${collections.length} available collection`);
    const songs = list;
    const res = [];
    collections.forEach((collection) => {
        const co = {
            name: collection.name,
            list: []
        };
        const listInCollection = collection.list;
        listInCollection.forEach((_s) => {
            const bool = songs.some((song) => {
                if (
                    song.metadata.title.trim() === _s.name.trim() &&
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
}).then(function (collections) {
    return collections.filter((collection) => {
        const failList = [];
        let successCount = 0;
        console.log(`Matching ${collection.name}...`);
        collection.list = collection.list.filter((song) => {
            if (!song.path) {
                console.log(`    Missing: ${song.artists.join('/')} - ${song.name}`);
                return false;
            }
            else {
                successCount++;
                return true;
            }
        });
        return successCount;
    });
}).then(function (collections) {
    if (program.pls) {
        require('./writers/pls')(collections, output);
    }
    else {
        require('./writers/m3u')(collections, output);
    }
});

