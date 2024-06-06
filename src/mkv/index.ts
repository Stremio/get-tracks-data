import { Decoder } from 'ts-ebml';
import type { EBMLElementDetail, MasterElement, ChildElementValue } from 'ts-ebml';
import { TrackType } from '@/parser';
import { Parser, Track } from '@/parser';

const TRACKS_ELEMENT_NAME = 'Tracks';

const ELEMENT_NAMES_MAP: Record<string, string | null> = {
    'TrackEntry': null,
    'TrackNumber': 'id',
    'TrackType': 'type',
    'Language': 'lang',
    'CodecID': 'codec',
};

const TRACK_TYPE_VALUE_MAP: Record<number, TrackType> = {
    1: TrackType.Video,
    2: TrackType.Audio,
    17: TrackType.Text,
};

const SIGNATURE = '1A45DFA3';
const SIGNATURE_OFFSET = 0;

const create = (): Parser => {
    let bufferSize = 0;
    let bufferSizeLimit = 0;
    const elements: EBMLElementDetail[][] = [];
    const decoder = new Decoder();

    const decode = (buffer: Buffer) => new Promise<EBMLElementDetail[]>((resolve, reject) => {
        try {
            if (bufferSizeLimit > 0 && bufferSize >= bufferSizeLimit)
                return resolve(elements.flat(1));

            const decoded = decoder.decode(buffer);
            const tracksElement = decoded.find(({ name }) => name === TRACKS_ELEMENT_NAME);
            const decodedElements = decoded.filter(({ name }) => Object.keys(ELEMENT_NAMES_MAP).includes(name));

            elements.push(decodedElements);

            if (bufferSizeLimit === 0 && tracksElement)
                bufferSizeLimit = tracksElement.dataEnd;

            bufferSize += buffer.byteLength;
        } catch(e) {
            console.error(e);
            reject('Failed to decode buffer');
        }
    });

    const format = (elements: EBMLElementDetail[]) => new Promise<Track[]>((resolve, reject) => {
        try {
            const tracks: Track[] = [];
            let track = new Track();

            elements.forEach((element) => {
                if (element.name === 'TrackEntry') {
                    const { isEnd } = element as MasterElement;
                    !isEnd ? track = new Track() : tracks.push(track);
                }

                if (element.name !== 'TrackEntry') {
                    const childElement = element as ChildElementValue;
                    const name = ELEMENT_NAMES_MAP[childElement.name] as keyof Track;

                    const parseValue = (value: string | number) => {
                        if (name === 'type' && typeof value === 'number')
                            return TRACK_TYPE_VALUE_MAP[value] ?? value;

                        if (name === 'lang')
                            return value === 'und' ? null : value;

                        if (name === 'codec' && typeof value === 'string')
                            return value
                                .replace('V_', '')
                                .replace('A_', '')
                                .replace('S_', '');

                        return value;
                    };

                    const value = parseValue(childElement.value);

                    switch(name) {
                        case 'id':
                            track.id = value as number;
                        case 'type':
                            track.type = value as TrackType;
                        case 'lang':
                            track.lang = value as string;
                        case 'codec':
                            track.codec = value as string;
                    }
                }
            });

            resolve(tracks);
        } catch(e) {
            console.error(e);
            reject('Failed to parse tracks data');
        }
    });

    return {
        decode,
        format,
    };
};

export {
    SIGNATURE,
    SIGNATURE_OFFSET,
    create,
};
