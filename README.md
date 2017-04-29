## playlist-generator

Generate playlist from local library, now support netease music collection and custom adaptor, output `m3u8` format as default.

> Make sure that all music files in your local library contain collect id3 information.

### Install & Help

```
npm install playlist-generator -g

playlist-generator --help

```

### Sample Usage (Netease Cloud Music Collection)

For MacOS

1. Place your music files in `~/Music`, create a directory for playlist files `~/Playlits`
2. Download and install Netease Cloud Music, login and create your own collections
3. Download `adaptors/netease.js` to `~/Downloads/netease.js`
4. run

```
npm install playlist-generator -g
playlist-generator -l ~/Music -o ~/Playlits -a ~/Downloads/netease.js --wpl
```

> `wpl` format is most compatible with some old deivces.
