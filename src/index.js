const { createSteam } = require('./stream');

const PARSERS = [
    require('./mkv'),
    require('./mp4'),
];

const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;

const createParser = (buffer) => {
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

const getTracksData = async (input, options) => {
    const stream = await createSteam(input);

    let parser = null;

    return new Promise((resolve, reject) => {
        const onSkip = (start, end) => {
            stream.pause();
            stream.bytesOffset = start;
            stream.chunkSize = end ?? DEFAULT_CHUNK_SIZE;
            stream.resume(); 
        };

        const onFinish = (tracks) => {
            stream.destroy();
            resolve(tracks);
        };

        const onError = (error) => {
            stream.destroy();
            reject(error);
        };

        const onData = async (chunk) => {
            if (stream.bytesRead >= options?.maxBytesLimit)
                return onError(`Reached maxBytesLimit of ${options.maxBytesLimit}`);

            parser = parser ?? createParser(chunk);

            if (!parser)
                return onError('This file type is not supported');

            parser
                .parse(chunk, onSkip)
                .then(() => stream.destroy())
                .catch(onError);
        };

        const onClose = async () => {
            parser && parser
                .finish()
                .then(onFinish)
                .catch(onError);
        };

        stream
            .on('error', onError)
            .on('close', onClose)
            .on('data', onData);
    });
};

module.exports = getTracksData;
