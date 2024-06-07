import { TrackType } from '@/parser';
import { Parser, Track } from '@/parser';
import { bufferToInt, parseElements } from './utils';
import type { Element } from './utils';

const parseTrackNumber = (trackNumber?: Element) => {
    if (!trackNumber) return null;

    const id = trackNumber.data;
    return bufferToInt(id);
};

const parseTrackType = (trackType?: Element) => {
    if (!trackType) return null;

    const type = trackType.data;
    return TRACK_TYPE_VALUES[bufferToInt(type)];
};

const parseLanguage = (language?: Element) => {
    if (!language) return null;

    const lang = language.data.toString();
    return lang === 'und' ? null : lang;
};

const parseCodecID = (codecID?: Element) => {
    if (!codecID) return null;

    const codec = codecID.data.toString();
    return codec
        .replace('V_', '')
        .replace('A_', '')
        .replace('S_', '');
};

const TRACK_TYPE_VALUES: Record<number, TrackType> = {
    1: TrackType.Video,
    2: TrackType.Audio,
    17: TrackType.Text,
};

const SIGNATURE = '1A45DFA3';
const SIGNATURE_OFFSET = 0;

const create = (): Parser => {
    const decode = (buffer: Buffer) => new Promise<Element>((resolve, reject) => {
        try {
            const elements = parseElements(buffer);

            const segment = elements.find(({ name }) => name === 'Segment');
            if (!segment) return reject();

            const segmentElements = parseElements(segment.data);

            const tracks = segmentElements.find(({ name }) => name === 'Tracks');
            if (!tracks) return reject();

            resolve(tracks);
        } catch(e) {
            console.error(e);
            reject('Failed to decode buffer');
        }
    });

    const format = (element: Element) => new Promise<Track[]>((resolve, reject) => {
        try {
            const tracksTags = parseElements(element.data);

            const trackEntries = tracksTags.filter(({ name }) => name === 'TrackEntry');
            if (!trackEntries) return reject();

            const tracks: Track[] = trackEntries
                .map((trackEntry) => parseElements(trackEntry.data))
                .map((trackEntryTags) => {
                    const trackNumber = trackEntryTags.find(({ name }) => name === 'TrackNumber');
                    const trackType = trackEntryTags.find(({ name }) => name === 'TrackType');
                    const language = trackEntryTags.find(({ name }) => name === 'Language');
                    const languageBCP47 = trackEntryTags.find(({ name }) => name === 'LanguageBCP47');
                    const codecID = trackEntryTags.find(({ name }) => name === 'CodecID');

                    return {
                        trackNumber,
                        trackType,
                        language,
                        languageBCP47,
                        codecID,
                    };
                })
                .map(({ trackNumber, trackType, language, languageBCP47, codecID }) => {
                    const id = parseTrackNumber(trackNumber);
                    const type = parseTrackType(trackType);
                    const lang = parseLanguage(language) ?? parseLanguage(languageBCP47);
                    const codec = parseCodecID(codecID);

                    return {
                        id,
                        type,
                        lang,
                        codec,
                    };
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
