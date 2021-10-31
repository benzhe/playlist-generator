/**
 * 1. 安装网易云音乐客户端并登录
 * 2. 确认左侧有你收藏/喜欢的歌单
 * 3. 依次点击左侧歌单，系统会将歌单详情储存在本地数据库
 * 4. 使用该脚本
 */

const request = require('request');
const sqlite3 = require('sqlite3');
const path = require('path'); 
const util = require('util');
const pqueue = require('p-queue'); 
const isWsl = require('is-wsl');  
const execSync = require('child_process').execSync;

let dbPath = path.resolve(getUserHome(),
    './Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3');

if (isWsl) {
    const userHome = execSync('wslpath "$(wslvar USERPROFILE)"', { encoding: 'UTF-8'}).trim();
    dbPath = `${userHome}/AppData/Local/Netease/CloudMusic/Library/webdb.dat`
}


const returnList = [];
 

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function getCollectionList() {
    return new Promise(function (resolve, reject) {
        (async () => {
            const db = new sqlite3.Database(dbPath);
        
            const dbAll = util.promisify(db.all.bind(db));
            db.serialize(async function () {
                let userRows = await dbAll(`SELECT * FROM web_user_playlist`);
                let pids = [];
                userRows.forEach(function(row) {
                    pids = pids.concat(row.pids.split(',').filter((item) => item)).map(parseFloat);
                });
                const query = `SELECT * FROM web_playlist WHERE pid IN (${pids.join(',')})`;
                let webRows = await dbAll(query);
                webRows = webRows.filter((row) => {
                    return JSON.parse(row.playlist).trackCount;
                });
                // console.log(webRows);
                let rows = await Promise.all(webRows.map(async (track) => {
                    const trackid = track.pid;
                    const trackInfo = JSON.parse(track.playlist);
                    let tids = await dbAll(`SELECT tid FROM web_playlist_track WHERE pid = ${trackid}`);
                    tids = tids.map((o) => o.tid);
                    const songs = await dbAll(`SELECT track FROM web_track WHERE tid IN (${tids.join(',')})`);
                    const trackInfoAndSongs = parseCollectionDetail(trackInfo, songs);
                    return trackInfoAndSongs;
                }));
                resolve(rows);
                db.close();
            });

        })();

        
    });
}

function parseCollectionDetail(trackInfo, songs) {
    const name = trackInfo.name;
    const list = songs.map((song) => {
        const songInfo = JSON.parse(song.track);
        const s = {
            name: songInfo.name,
            album: songInfo.album.name
        };
        s.artists = [];
        songInfo.artists.forEach((artist) => {
            s.artists.push(artist.name);
            if (artist.alias && artist.alias[0])
                s.artists.push(artist.alias[0]);
        });
        return s;
    });
    const co = {
        name,
        list
    };
    console.log(`成功获取歌单信息：${name} 共 ${list.length} 首歌`);
    return co;
}
 
function run() {
    return getCollectionList();
}

if (require.main !== module) module.exports = run;
else run();