import { createStream } from './stream';
import * as MKV from './mkv';
import * as MP4 from './mp4';
import type { Parser, Track } from './parser';

const PARSERS = [MKV, MP4];
const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;

const useParser = (buffer: Buffer) => {
    const parser = PARSERS.find(({ SIGNATURE, SIGNATURE_OFFSET }) => {
        const signatureBuffer = Buffer.from(SIGNATURE, 'hex');
        const bufferToCompare = buffer.subarray(
            SIGNATURE_OFFSET,
            signatureBuffer.length + SIGNATURE_OFFSET,
        );

        return Buffer.compare(signatureBuffer, bufferToCompare) === 0;
    });

    return parser && parser.create();
};

type Options = {
    maxBytesLimit?: number
};

const getTracksData = async (input: string, options?: Options) => {
    const stream = await createStream(input);

    let parser: Parser | undefined = undefined;
    let decoded: any = null;

    return new Promise<Track[]>((resolve, reject) => {
        const onSkip = (start: number, end?: number) => {
            stream.pause();
            stream.bytesOffset = start;
            stream.chunkSize = end ?? DEFAULT_CHUNK_SIZE;
            stream.resume();
        };

        const onDecoded = (data: any) => {
            stream.destroy();
            decoded = data;
        };

        const onError = (reason: string) => {
            stream.destroy();
            reject(reason);
        };

        const onData = async (chunk: Buffer) => {
            if (options?.maxBytesLimit && stream.bytesRead >= options.maxBytesLimit)
                return onError(`Reached maxBytesLimit of ${options.maxBytesLimit}`);

            parser = parser ?? useParser(chunk);

            if (!parser)
                return onError('This file type is not supported');

            parser
                .decode(chunk, onSkip)
                .then(onDecoded)
                .catch(onError);
        };

        const onClose = async () => {
            parser && parser
                .format(decoded)
                .then(resolve)
                .catch(onError);
        };

        stream
            .on('error', onError)
            .on('close', onClose)
            .on('data', onData);
    });
};

export default getTracksData;
