import { createStream } from './stream';
import MKV from './mkv';
import MP4 from './mp4';
import type { Parser, Track } from './parser';

const DEFAULT_CHUNK_SIZE = 15 * 1024 * 1024;

const useParser = (parsers: Parser[], buffer: Buffer) => {
    return parsers.find((parser) => parser.compare(buffer));
};

type Options = {
    maxBytesLimit?: number
};

const getTracksData = async (input: string, options?: Options) => {
    const stream = await createStream(input);

    const parsers = [
        new MKV(),
        new MP4(),
    ];

    let parser: Parser | undefined = undefined;

    return new Promise<Track[]>((resolve, reject) => {
        const readChunk = (start: number, length?: number) => {
            stream.pause();
            stream.bytesOffset = start;
            stream.chunkSize = length ?? DEFAULT_CHUNK_SIZE;
            stream.resume();
        };

        const onDecoded = (decoded: any) => {
            stream.destroy();

            parser && parser
                .format(decoded)
                .then(resolve)
                .catch(onError);
        };

        const onError = (reason: string) => {
            stream.destroy();
            reject(reason);
        };

        const onData = async (chunk: Buffer) => {
            if (options?.maxBytesLimit && stream.bytesRead >= options.maxBytesLimit)
                return onError(`Reached maxBytesLimit of ${options.maxBytesLimit}`);

            parser = parser ?? useParser(parsers, chunk);

            if (!parser)
                return onError('This file type is not supported');

            parser
                .decode(chunk, readChunk)
                .then(onDecoded)
                .catch(onError);
        };

        stream
            .on('error', onError)
            .on('data', onData);
    });
};

export default getTracksData;
