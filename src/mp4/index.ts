import { Parser, TrackType } from '@/parser';
import type { Track } from '@/parser';
import { parseBoxes, parseHDLRBox, parseMDHDBox, parseSTSDBox, parseTKHDBox } from './utils';
import type { BoxContainer } from './utils';

const SIGNATURE = '66747970';
const SIGNATURE_OFFSET = 4;

const HDLR_TYPE_MAP: Record<string, TrackType> = {
    'vide': TrackType.Video,
    'soun': TrackType.Audio,
    'text': TrackType.Text,
};

const MDHD_LANG_NULL_VALUES = ['und', '```'];

class MP4 extends Parser {
    offset = 0;

    constructor() {
        super(SIGNATURE, SIGNATURE_OFFSET);
    }

    _decode(chunk: Buffer, readChunk: (start: number, length?: number) => void) {
        return new Promise<BoxContainer>((resolve) => {
            const boxes = parseBoxes(chunk);
            const moovBox = boxes.find(({ name }) => name === 'moov');
            const mdatBox = boxes.find(({ name }) => name === 'mdat');
            const freeBox = boxes.find(({ name }) => name === 'free');

            if (!moovBox && freeBox) {
                this.offset += freeBox.offset + freeBox.size.toNumber();
                return readChunk(this.offset);
            }

            if (!moovBox && mdatBox) {
                this.offset += mdatBox.offset + mdatBox.size.toNumber();
                return readChunk(this.offset);
            }

            if (moovBox && moovBox.data.length !== moovBox.dataSize.toNumber()) {
                this.offset += moovBox.offset + moovBox.size.toNumber();
                return readChunk(moovBox.offset, moovBox.size.toNumber());
            }

            if (moovBox && moovBox.data.length === moovBox.dataSize.toNumber())
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
                const hdlrBoxContainer = mdiaBoxes.find(({ name }) => name === 'hdlr');
                const minfBoxContainer = mdiaBoxes.find(({ name }) => name === 'minf');

                if (!mdhdBoxContainer || !hdlrBoxContainer || !minfBoxContainer) return null;

                const MDHD = parseMDHDBox(mdhdBoxContainer.data);
                const HDLR = parseHDLRBox(hdlrBoxContainer.data);
                
                const minfBoxes = parseBoxes(minfBoxContainer.data);
                const stblBoxContainer = minfBoxes.find(({ name }) => name === 'stbl');

                if (!stblBoxContainer) return null;

                const stblBoxes = parseBoxes(stblBoxContainer.data);
                const stsdBoxContainer = stblBoxes.find(({ name }) => name === 'stsd');

                if (!stsdBoxContainer) return null;

                const STSD = parseSTSDBox(stsdBoxContainer.data);

                const id = TKHD.id ?? null;
                const type = HDLR_TYPE_MAP[HDLR.handlerType] ?? null;
                const lang = MDHD_LANG_NULL_VALUES.includes(MDHD.language) ? null : MDHD.language;
                const label = HDLR.name.length ? HDLR.name : null;
                const codec = STSD?.entries?.[0]?.name ?? null;

                const track: Track = {
                    id,
                    type,
                    lang,
                    label,
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
