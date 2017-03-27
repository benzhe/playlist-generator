
const request = require('request');
const sqlite3 = require('sqlite3');
const path = require('path');
const cheerio = require('cheerio')
const pqueue = require('p-queue');

const dbPath = path.resolve(getUserHome(),
    './Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3');

const returnList = [];

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function getCollectionList() {
    return new Promise(function (resolve, reject) {
        const db = new sqlite3.Database(dbPath);
        let pids = [];
        db.serialize(function () {
            db.all(`SELECT * FROM web_user_playlist`, function (err, rows) {
                // console.log(rows);
                rows.forEach(function(row) {
                    pids = pids.concat(row.pids.split(',').filter((item) => item)).map(parseFloat);
                });
                console.log(pids);
                const query = `SELECT * FROM web_playlist WHERE pid IN (${pids.join(',')})`;
                db.all(query, function(err, rows) {
                    // console.log(rows.length);
                    resolve(rows);
                });
                db.close();
            });

        });
    });
}

function getCollectionDetail(collection) {
    return new Promise(function (resolve, reject) {
        const id = collection.pid;
        const url = `http://music.163.com/playlist?id=${id}`;
        request({
            url
        }, function (error, response, body) {
            const $ = cheerio.load(body);
            const $els = $('ul.f-hide + textarea');
            if ($els.length === 1) {
                const list = JSON.parse($els.text());
                // console.log(list.length);
                returnList.push(parseCollectionDetail(collection, list));
            }
            resolve();
        });

    });
}

function parseCollectionDetail(collection, list) {
    const name = JSON.parse(collection.playlist).name;
    const songs = list.map((song) => {
        const s = {
            name: song.name,
            album: song.album.name
        };
        s.artists = [];
        song.artists.forEach((artist) => {
            s.artists.push(artist.name);
            if (artist.alias && artist.alias[0])
                s.artists.push(artist.alias[0]);
        });
        return s;
    });
    const co = {
        name,
        list: songs
    };
    return co;
}

function run() {
    return getCollectionList().then(function(collections) {
        const queue = new pqueue({concurrency: 1});
        collections.forEach(function(collection) {
            queue.add(() => getCollectionDetail(collection));
        });
        return queue.onEmpty();
    }).then(function(){
        const res = returnList.filter((item) => item);
        return res;
    });
}

module.exports = run;
