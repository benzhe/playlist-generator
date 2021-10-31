/**
 * 1. 请先安装网易云音乐客户端并登录，确认左侧有你收藏/喜欢的歌单
 * 2. 执行过程请输入在浏览器中登录 music.163.com 后改网页的 cookie value
 * 3. 不登录仅支持每歌单 10 首歌，登录后仅 20 首歌
 * 4. 完整歌单建议使用 netease-local
 */

const request = require('request');
const sqlite3 = require('sqlite3');
const path = require('path');
const cheerio = require('cheerio')
const pqueue = require('p-queue');
const puppeteer = require('puppeteer');
const platform = require('os').platform();
const isWsl = require('is-wsl');
const inquirer = require('inquirer');
const converCookieStr = require('../utils/cookie');

let dbPath = path.resolve(getUserHome(),
    './Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3');

if (isWsl) {
    const userHome = execSync('wslpath "$(wslvar USERPROFILE)"', { encoding: 'UTF-8' }).trim();
    dbPath = `${userHome}/AppData/Local/Netease/CloudMusic/Library/webdb.dat`
}


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
                rows.forEach(function (row) {
                    pids = pids.concat(row.pids.split(',').filter((item) => item)).map(parseFloat);
                });
                const query = `SELECT * FROM web_playlist WHERE pid IN (${pids.join(',')})`;
                db.all(query, function (err, rows) {
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

let hasSetCookie = false;
async function getNewPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36');
    if (!hasSetCookie) {
        hasSetCookie = true;
        let cookieStr = '';
        let ans = await inquirer.prompt([
            {
                name: 'cookie',
                message: '网易云音乐 Cookie：',
            }
        ]);
        cookieStr = ans['cookie'] ? ans['cookie'] : cookieStr;
        console.log('GET COOKIE:', cookieStr);
        const cookies = converCookieStr(cookieStr);
        await page.setCookie(...cookies);

    }
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
            await frame.waitForSelector('.m-table', {
                timeout: 60000
            });
            const tableHTML = await frame.$eval('.m-table', node => node.outerHTML);

            //console.log(tableHTML);

            const $table = cheerio.load(tableHTML);

            const $list = $table('.icn.icn-share[data-res-id]');

            const list = Array.from($list.map((index, $item) => {
                // console.log($item.attribs['data-res-name']);
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
            getCollectionList().then(function (collections) {
                const queue = new pqueue({ concurrency: 1 });
                collections.forEach(function (collection) {
                    queue.add(() => getCollectionDetail(collection));
                });
                return queue.onEmpty();
            }).then(function () {
                const res = returnList.filter((item) => item);
                resolve(res);
            });
        });
    })
}

if (require.main !== module) module.exports = run;
else run();