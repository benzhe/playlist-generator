/**
 * 仅支持 Mac OS，请先安装网易云音乐客户端并登录，确认左侧有你收藏/喜欢的歌单
 */

const request = require('request');
const sqlite3 = require('sqlite3');
const path = require('path');
const cheerio = require('cheerio')
const pqueue = require('p-queue');
const puppeteer = require('puppeteer');

const dbPath = path.resolve(getUserHome(),
    './Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3');

const returnList = [];

let browser = null;

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function getCollectionList() {
    return new Promise(function (resolve, reject) {
        const db = new sqlite3.Database(dbPath);
        let pids = [];
        db.serialize(function () {
            db.all(`SELECT * FROM web_user_playlist`, function (err, rows) {
                rows.forEach(function(row) {
                    pids = pids.concat(row.pids.split(',').filter((item) => item)).map(parseFloat);
                });
                const query = `SELECT * FROM web_playlist WHERE pid IN (${pids.join(',')})`;
                db.all(query, function(err, rows) {
                    rows = rows.filter((row) => {
                        return JSON.parse(row.playlist).trackCount;
                    })
                    resolve(rows);
                });
                db.close();
            });

        });
    });
}

async function getNewPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
        'Accept-Encoding' : 'gzip, deflate',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'http://music.163.com/'
    });
    return page;
}

function getCollectionDetail(collection) {
    return new Promise(function (resolve, reject) {
        (async () => {
            const page = await getNewPage(browser);
                
            const id = collection.pid;
            const url = `http://music.163.com/#/playlist?id=${id}`;
            // console.log(url);
            await page.goto(url, {
                timeout: 90 * 1000,
                waitUntil: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
            });
            const frame = await page.frames().find(f => f.name() === 'contentFrame');
            await frame.waitForSelector('.m-table');
            // const table = await frame.$('.m-table');
            const tableHTML = await frame.$eval('.m-table', node => node.outerHTML);

            const $table = cheerio.load(tableHTML);

            const $list = $table('.icn.icn-share[data-res-id]');

            const list = Array.from($list.map((index, $item) => {
                return {
                    name: $item.attribs['data-res-name'],
                    // album: song.album.name,
                    artists: $item.attribs['data-res-author'].split('/')
                }
            }));

            const name = JSON.parse(collection.playlist).name;

            const res = {
                name,
                list,
            }

            returnList.push(res);

            console.log(`成功下载歌单信息：${name} 共 ${list.length} 首歌：${url}`);

            resolve(res);
        })();

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
    console.log(`成功下载歌单信息：${name} 共 ${songs.length} 首歌`);
    return co;
}

function initBrowser() {
    return new Promise((resolve, reject) => {
        (async () => {
            browser = await puppeteer.launch({
                timeout: 60 * 1000,
                args: ['--no-sandbox']
            });
            resolve(browser);
        })();
    })
}

function run() {
    return initBrowser().then(() => {
        return new Promise((resolve, reject) => {
            getCollectionList().then(function(collections) {
                const queue = new pqueue({concurrency: 1});
                collections.forEach(function(collection) {
                    queue.add(() => getCollectionDetail(collection));
                });
                return queue.onEmpty();
            }).then(function(){
                const res = returnList.filter((item) => item);
                resolve(res);
            });
        });
    })
}

if (require.main !== module) module.exports = run;
else run();