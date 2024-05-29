# get-tracks-data

Allow you to get tracks data from video files from MKV and MP4 files.

## Example
```js
const getTracksData = require('get-tracks-data');
const stream = fs.createReadStream(path.resolve(__dirname, 'video.mkv'));

getTracksData(stream)
    .then((data) => {
        console.log(data);
    }).catch((e) => {
        console.error(e);
    });
```
Example of data returned:
```js
[
  { id: 1, type: 'video', lang: 'und', codec: 'avc1' },
  { id: 2, type: 'audio', lang: 'eng', codec: 'mp4a' },
  { id: 3, type: 'audio', lang: 'fra', codec: 'mp4a' }
]
```