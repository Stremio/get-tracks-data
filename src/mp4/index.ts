import { Parser, TrackType } from '@/parser';
import type { Track } from '@/parser';
import { parseBoxes, parseMDHDBox, parseSTSDBox, parseTKHDBox } from './utils';
import type { BoxContainer } from './utils';

const SIGNATURE = '66747970';
const SIGNATURE_OFFSET = 4;

const BOX_NAME_TYPE_MAP: Record<string, TrackType> = {
    'vmhd': TrackType.Video,
    'smhd': TrackType.Audio,
};

const MDHD_LANG_NULL_VALUES = ['und', '```'];

class MP4 extends Parser {
    constructor() {
        super(SIGNATURE, SIGNATURE_OFFSET);
    }

    _decode(chunk: Buffer, onSkip: (start: number, end?: number) => void) {
        return new Promise<BoxContainer>((resolve) => {
            const boxes = parseBoxes(chunk);
            const moovBox = boxes.find(({ name }) => name === 'moov');
            const mdatBox = boxes.find(({ name }) => name === 'mdat');

            if (!moovBox && mdatBox)
                return onSkip(mdatBox.offset + mdatBox.size);

            if (moovBox && moovBox.data.length !== moovBox.dataSize)
                return onSkip(moovBox.offset, moovBox.offset + moovBox.size);

            if (moovBox && moovBox.data.length === moovBox.dataSize)
                return resolve(moovBox);
        });
    }

    _format(decoded: BoxContainer) {
        return new Promise<Track[]>((resolve) => {
            const moovBoxes = parseBoxes(decoded.data);
            const trakBoxes = moovBoxes.filter(({ name }) => name === 'trak');

            const tracks = trakBoxes.map((trakBoxContainer) => {
                const trakBoxes = parseBoxes(trakBoxContainer.data);

                const tkhdBoxContainer = trakBoxes.find(({ name }) => name === 'tkhd');
                const mdiaBoxContainer = trakBoxes.find(({ name }) => name === 'mdia');

                if (!tkhdBoxContainer || !mdiaBoxContainer) return null;

                const TKHD = parseTKHDBox(tkhdBoxContainer.data);
                const mdiaBoxes = parseBoxes(mdiaBoxContainer.data);

                const mdhdBoxContainer = mdiaBoxes.find(({ name }) => name === 'mdhd');
                const minfBoxContainer = mdiaBoxes.find(({ name }) => name === 'minf');

                if (!mdhdBoxContainer || !minfBoxContainer) return null;

                const MDHD = parseMDHDBox(mdhdBoxContainer.data);
                const minfBoxes = parseBoxes(minfBoxContainer.data);

                const tmhdBoxContainer = minfBoxes.find(({ name }) => Object.keys(BOX_NAME_TYPE_MAP).includes(name));
                const stblBoxContainer = minfBoxes.find(({ name }) => name === 'stbl');

                if (!stblBoxContainer || !tmhdBoxContainer) return null;

                const stblBoxes = parseBoxes(stblBoxContainer.data);
                const stsdBoxContainer = stblBoxes.find(({ name }) => name === 'stsd');

                if (!stsdBoxContainer) return null;

                const STSD = parseSTSDBox(stsdBoxContainer.data);

                const id = TKHD.id;
                const type = BOX_NAME_TYPE_MAP[tmhdBoxContainer.name];
                const lang = MDHD_LANG_NULL_VALUES.includes(MDHD.language) ? null : MDHD.language;
                const codec = STSD?.entries?.[0]?.name;

                const track: Track = {
                    id,
                    type,
                    lang,
                    codec,
                };

                return track;
            });

            const filteredTracks = tracks.filter((t): t is Track => t !== null);
            resolve(filteredTracks);
        });
    }
};

export default MP4;
