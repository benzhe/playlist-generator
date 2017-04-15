## playlist-generator

Generate playlist from local library, now support netease music collection and custom adaptor, output `m3u8` format as default.

### Install & Help

```
npm install playlist-generator -g

playlist-generator --help

```

### Sample Usage

```
playlist-generator -l /Volumes/lexar/Music -o /Volumes/lexar/Playlists -a {Your adaptor} --wpl
```

> `wpl` format is most compatible with some old deivces.