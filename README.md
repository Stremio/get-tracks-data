# get-tracks-data

Get video / audio / subtitles tracks from MKV and MP4 files.

## Installation
```bash
npm i get-tracks-data
```

## Examples

### File

```js
const path = require('path');
const getTracksData = require('get-tracks-data');

const file = path.resolve(__dirname, 'video.mkv');

try {
    const tracks = await getTracksData(file);
    console.log(tracks);
} catch (e) {
    console.error(e);
}
```

### Url

```js
const getTracksData = require('get-tracks-data');

const url = 'https://mywebsite.com/video.mp4';

try {
    const tracks = await getTracksData(url);
    console.log(tracks);
} catch (e) {
    console.error(e);
}
```

Example of data returned:
```js
[
  { id: 1, type: 'video', lang: null, codec: 'MPEGH/ISO/HEVC' },
  { id: 2, type: 'audio', lang: 'spa', codec: 'EAC3' },
  { id: 3, type: 'text', lang: 'fre', codec: 'TEXT/UTF8' }
]
```

## Options
You can pass an options object:

```js
const options = {
    maxBytesLimit: 1e+7, // Will destroy stream and reject the promise when this limit is reached on data read  
};

try {
    await getTracksData(stream, options);
} catch(e) {
    console.error(e);
}
```
