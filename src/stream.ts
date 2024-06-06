import fs from 'fs';
import https from 'https';
import { Readable } from 'stream';
import type { IncomingMessage } from 'http';

const CONTENT_RANGE_REGEX = /bytes (\d+)-(\d+)\/(\d+)/;

const isUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
};

class HttpsStream extends Readable {
    private url: string;
    private contentLength: number;
    public bytesRead: number;
    public bytesOffset: number;
    public chunkSize: number;

    constructor(url: string) {
        super();

        this.url = url;
        this.contentLength = this.readableHighWaterMark;
        this.bytesRead = 0;
        this.bytesOffset = 0;
        this.chunkSize = this.readableHighWaterMark;
    }

    _request = (range: number[]): Promise<IncomingMessage> => {
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

    _requestRange = async (range: number[]): Promise<[Buffer, number]> => {
        const response = await this._request(range);

        const contentRange = response.headers?.['content-range'];
        if (!contentRange)
            return Promise.reject('Failed to retrieve Content-Range from headers');

        const matches = CONTENT_RANGE_REGEX.exec(contentRange);
        if (!matches)
            return Promise.reject('Failed to parse range from Content-Range header');

        const [,,, contentLength] = matches;
        if (!contentLength)
            return Promise.reject('Failed to parse length from Content-Range header');

        return new Promise<[Buffer, number]>((resolve, reject) => {
            const chunks: Buffer[] = [];

            response.on('data', (chunk) => {
                chunks.push(chunk);
            });

            response.on('end', () => {
                resolve([Buffer.concat(chunks), parseInt(contentLength)]);
            });

            response.on('error', reject);
        });
    }

    async _read() {
        try {
            const start = this.bytesOffset;
            const end = Math.min(this.contentLength, this.bytesOffset + this.chunkSize) - 1;
            const range = [start, end];

            const [chunk, contentLength] = await this._requestRange(range);

            this.contentLength = contentLength;
            this.bytesRead += chunk.length;
            this.bytesOffset += chunk.length;
            this.push(chunk);
        } catch(e) {
            this.emit('error', e);
            this.push(null);
        }
    }
};

class FileStream extends Readable {
    private path: string;
    private fileSize: number;
    public bytesRead: number;
    public bytesOffset: number;
    public chunkSize: number;

    constructor(path: string) {
        super();

        const stats = fs.statSync(path);

        this.path = path;
        this.fileSize = stats.size;
        this.bytesRead = 0;
        this.bytesOffset = 0;
        this.chunkSize = this.readableHighWaterMark;
    }

    _requestRange = async (range: number[]): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const stream = fs.createReadStream(this.path, {
                start: range[0],
                end: range[1],
            });

            stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            stream.on('error', reject);
        });
    }

    async _read() {
        try {
            const start = this.bytesOffset;
            const end = Math.min(this.fileSize, this.bytesOffset + this.chunkSize) - 1;
            const range = [start, end];

            const chunk = await this._requestRange(range);

            this.bytesRead += chunk.length;
            this.bytesOffset += chunk.length;
            this.push(chunk);
        } catch(e) {
            this.emit('error', e);
            this.push(null);
        }
    }
};

const createStream = async (input: string) => {
    return isUrl(input) ? new HttpsStream(input) : new FileStream(input);
};

export {
    createStream,
    HttpsStream,
    FileStream,
};
