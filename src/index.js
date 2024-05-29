const PARSERS = [
    require('./mkv'),
    require('./mp4'),
];

const createParser = (parsers, buffer) => {
    const parser = parsers.find(({ SIGNATURE, SIGNATURE_OFFSET }) => {
        const signatureBuffer = Buffer.from(SIGNATURE, 'hex');
        const bufferToCompare = buffer.subarray(
            SIGNATURE_OFFSET,
            signatureBuffer.length + SIGNATURE_OFFSET,
        );
        
        return Buffer.compare(signatureBuffer, bufferToCompare) === 0;
    });

    return parser && parser.create();
};

const getTracksData = (stream) => {
    return new Promise((resolve, reject) => {
        let parser = null;

        const onFinish = (tracks) => {
            stream.destroy();
            resolve(tracks);
        };

        const onError = (error) => {
            stream.destroy();
            reject(error);
        };

        const onData = async (chunk) => {
            const onSkip = (bytes) => {
                stream.read(Math.min(1e+9, bytes));
            };

            parser = parser ?? createParser(PARSERS, chunk);

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
