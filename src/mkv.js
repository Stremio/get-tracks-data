const ebml = require('ts-ebml');

const decoder = new ebml.Decoder();

const TRACKS_ELEMENT_NAME = 'Tracks';

const ELEMENT_NAMES_MAP = {
    'TrackEntry': null,
    'TrackNumber': 'id',
    'TrackType': 'type',
    'Language': 'lang',
    'CodecID': 'codec',
};

const TRACK_TYPE_VALUE_MAP = {
    1: 'video',
    2: 'audio',
    17: 'text',
};

const parseTrackElement = (element) => {
    const name = ELEMENT_NAMES_MAP[element.name];

    const parseValue = (value) => {
        if (name === 'type')
            return TRACK_TYPE_VALUE_MAP[value] ?? value;
        return value;
    };

    return [name, parseValue(element.value)];
};

const SIGNATURE = '1A45DFA3';
const SIGNATURE_OFFSET = 0;

const create = () => {
    let bufferSize = 0;
    let bufferSizeLimit = 0;
    const elements = [];

    const parse = (buffer) => new Promise((resolve, reject) => {
        try {
            if (bufferSizeLimit > 0 && bufferSize >= bufferSizeLimit)
                return resolve();

            const decoded = decoder.decode(buffer);
            const tracksElement = decoded.find(({ name }) => name === TRACKS_ELEMENT_NAME);
            const decodedElements = decoded.filter(({ name }) => Object.keys(ELEMENT_NAMES_MAP).includes(name));

            elements.push(decodedElements);

            if (bufferSizeLimit === 0 && tracksElement)
                bufferSizeLimit = tracksElement.dataEnd;

            bufferSize += buffer.byteLength;
        } catch(e) {
            reject(`Failed to parse buffer: ${e.message}`);
        }
    });

    const finish = () => new Promise((resolve, reject) => {
        try {
            let trackIndex = 0;
            const tracks = [];

            elements
                .flat(1)
                .forEach((element) => {
                    if (element.name === 'TrackEntry' && !element.isEnd) {
                        tracks[trackIndex] = {
                            id: null,
                            type: null,
                            lang: null,
                            codec: null,
                        };
                    }

                    if (element.name !== 'TrackEntry') {
                        const [name, value] = parseTrackElement(element);
                        tracks[trackIndex][name] = value;
                    }

                    if (element.name === 'TrackEntry' && element.isEnd) {
                        trackIndex++;
                    }
                });

            resolve(tracks);
        } catch(e) {
            reject(`Failed to parse tracks data: ${e.message}`);
        }
    });

    return {
        parse,
        finish,
    };
};

module.exports = {
    SIGNATURE,
    SIGNATURE_OFFSET,
    create,
};
