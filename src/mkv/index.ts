import { Parser, TrackType } from '@/parser';
import type { Track } from '@/parser';
import { bufferToInt } from '@/utils';
import { parseElements } from './utils';
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

const parseName = (name?: Element) => {
    if (!name) return null;

    return name.data.toString();
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

class MKV extends Parser {
    constructor() {
        super(SIGNATURE, SIGNATURE_OFFSET);
    }

    _decode(chunk: Buffer) {
        return new Promise<Element>((resolve, reject) => {
            const elements = parseElements(chunk);

            const segment = elements.find(({ name }) => name === 'Segment');
            if (!segment) return reject();

            const segmentElements = parseElements(segment.data);

            const tracks = segmentElements.find(({ name }) => name === 'Tracks');
            if (!tracks) return reject();

            resolve(tracks);
        });
    }

    _format(decoded: Element) {
        return new Promise<Track[]>((resolve, reject) => {
            const tracksTags = parseElements(decoded.data);

            const trackEntries = tracksTags.filter(({ name }) => name === 'TrackEntry');
            if (!trackEntries) return reject();

            const tracks: Track[] = trackEntries
                .map((trackEntry) => parseElements(trackEntry.data))
                .map((trackEntryTags) => {
                    const trackNumber = trackEntryTags.find(({ name }) => name === 'TrackNumber');
                    const trackType = trackEntryTags.find(({ name }) => name === 'TrackType');
                    const language = trackEntryTags.find(({ name }) => name === 'Language');
                    const languageBCP47 = trackEntryTags.find(({ name }) => name === 'LanguageBCP47');
                    const name = trackEntryTags.find(({ name }) => name === 'Name');
                    const codecID = trackEntryTags.find(({ name }) => name === 'CodecID');

                    return {
                        trackNumber,
                        trackType,
                        language,
                        languageBCP47,
                        name,
                        codecID,
                    };
                })
                .map(({ trackNumber, trackType, language, languageBCP47, name, codecID }) => {
                    const id = parseTrackNumber(trackNumber);
                    const type = parseTrackType(trackType);
                    const lang = parseLanguage(language) ?? parseLanguage(languageBCP47);
                    const label = parseName(name);
                    const codec = parseCodecID(codecID);

                    return {
                        id,
                        type,
                        lang,
                        label,
                        codec,
                    };
                });

            resolve(tracks);
        });
    }
};

export default MKV;
