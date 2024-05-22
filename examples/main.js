const fs = require('fs');
const path = require('path');
const getTracksData = require('../');

const stream = fs.createReadStream(path.resolve(__dirname, './test.mkv'));
getTracksData(stream)
    .then((data) => {
        console.log(data);
    }).catch((e) => {
        console.error(e);
    });