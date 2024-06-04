const fs = require('fs');
const https = require('https');
const { Readable } = require('stream');

const CONTENT_RANGE_REGEX = /bytes (\d+)-(\d+)\/(\d+)/;

const isUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
};

class HttpsStream extends Readable {
    constructor(url) {
        super();

        this.url = url;
        this.contentLength = this.readableHighWaterMark;
        this.bytesRead = 0;
        this.bytesOffset = 0;
        this.chunkSize = this.readableHighWaterMark;
    }

    _request = (range) => {
        return new Promise((resolve, reject) => {
            const { hostname, pathname } = new URL(this.url);

            const headers = {
                'range': `bytes=${range[0]}-${range[1]}`,
            };

            const options = {
                method: 'GET',
                hostname,  
                path: pathname,
                headers,
            };

            https
                .request(options, resolve)
                .on('error', reject)
                .end();
        });
    }

    _requestRange = async (range) => {
        const response = await this._request(range);

        const contentRange = response.headers['content-range'];
        const [,,, contentLength] = CONTENT_RANGE_REGEX.exec(contentRange);

        return new Promise((resolve, reject) => {
            const chunks = [];

            response.on('data', (chunk) => {
                chunks.push(chunk);
            });

            response.on('end', () => {
                resolve([Buffer.concat(chunks), contentLength]);
            });

            response.on('error', reject);
        });
    }

    async _read() {
        const start = this.bytesOffset;
        const end = Math.min(this.contentLength, this.bytesOffset + this.chunkSize) - 1;
        const range = [start, end];

        const [chunk, contentLength] = await this._requestRange(range);

        this.contentLength = contentLength;
        this.bytesRead += chunk.length;
        this.bytesOffset += chunk.length;
        this.push(chunk);
    }
};

class FileStream extends Readable {
    constructor(path) {
        super();

        const stats = fs.statSync(path);

        this.path = path;
        this.fileSize = stats.size;
        this.bytesRead = 0;
        this.bytesOffset = 0;
        this.chunkSize = this.readableHighWaterMark;
    }

    _requestRange = async (range) => {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const stream = fs.createReadStream(this.path, {
                start: range[0],
                end: range[1],
            });

            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            stream.on('error', reject);
        });
    }

    async _read() {
        const start = this.bytesOffset;
        const end = Math.min(this.fileSize, this.bytesOffset + this.chunkSize) - 1;
        const range = [start, end];

        const chunk = await this._requestRange(range);

        this.bytesRead += chunk.length;
        this.bytesOffset += chunk.length;
        this.push(chunk);
    }
};

const createSteam = async (input) => {
    return isUrl(input) ? new HttpsStream(input) : new FileStream(input);
};

module.exports = {
    createSteam,
};
