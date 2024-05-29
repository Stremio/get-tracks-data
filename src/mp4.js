const parseTkhdBox = (buffer, offset = 0) => {
    const versionFlag = buffer.readUInt32BE(offset);
    const creationTime = buffer.readUInt32BE(offset + 4);
    const modificationTime = buffer.readUInt32BE(offset + 8);
    const id = buffer.readUInt32BE(offset + 12);

    return {
        versionFlag,
        creationTime,
        modificationTime,
        id,
        offset,
    };
};

const parseMdhdBox = (buffer, offset = 0) => {
    const versionFlag = buffer.readUInt32BE(offset);
    const creationTime = buffer.readUInt32BE(offset + 4);
    const modificationTime = buffer.readUInt32BE(offset + 8);
    const timescale = buffer.readUInt32BE(offset + 12);
    const duration = buffer.readUInt32BE(offset + 16);
    const language = buffer.readUint16BE(offset + 20);

    const chars = [];
	chars[0] = (language>>10)&0x1F;
	chars[1] = (language>>5)&0x1F;
	chars[2] = (language)&0x1F;

    const languageString = String.fromCharCode(
        chars[0]+0x60,
        chars[1]+0x60,
        chars[2]+0x60
    );

    return {
        versionFlag,
        creationTime,
        modificationTime,
        timescale,
        duration,
        language: languageString,
        offset,
    };
};

const parseStsdBox = (buffer, offset = 0) => {
    const versionFlag = buffer.readUInt32BE(offset);
    const samples = buffer.readUInt32BE(offset + 4);
    
    const entries = [];
    for(let i = 1; i < (samples + 1); i++) {
        const size = buffer.readUInt32BE(offset + (8 * i));
        const name = buffer.subarray(offset + (12 * i), offset + (16 * i)).toString();
        const data = buffer.subarray(offset + (16 * i), offset + (16 * i) + size);

        entries.push({
            size,
            name,
            data,
        });
    };

    return {
        versionFlag,
        samples,
        entries,
        offset,
    };
};

const parseBox = (buffer, offset = 0) => {
    const size = buffer.readUInt32BE(offset);
    const name = buffer.subarray(offset + 4, offset + 8).toString();
    const data = buffer.subarray(offset + 8, offset + size);
    const dataSize = Math.max(0, size - 8);

    return {
        name,
        size,
        data,
        dataSize,
        offset,
    };
};

const parseBoxes = (buffer) => {
    const boxes = [];

    for (let offset = 0; offset < buffer.length;) {
        const box = parseBox(buffer, offset);
        boxes.push(box);

        offset += box.size;
    }

    return boxes;
};

const SIGNATURE = '66747970';
const SIGNATURE_OFFSET = 4;

const BOX_NAME_TYPE_MAP = {
    'vmhd': 'video',
    'smhd': 'audio',
};

const create = () => {
    const chunks = [];
    let tracksData = [];

    const parse = (chunk, onSkip) => new Promise((resolve, reject) => {
        try {
            chunks.push(chunk);

            const buffer = Buffer.concat(chunks);
            const boxes = parseBoxes(buffer);

            const moovBox = boxes.find(({ name }) => name === 'moov');
            const mdatBox = boxes.find(({ name }) => name === 'mdat');

            if (!moovBox && mdatBox)
                return onSkip(mdatBox.size - mdatBox.data.length);

            if (moovBox && moovBox.data.length === moovBox.dataSize) {
                const moovBoxes = parseBoxes(moovBox.data);
                const trakBoxes = moovBoxes.filter(({ name }) => name === 'trak');

                tracksData = trakBoxes
                    .map(({ data }) => parseBoxes(data))
                    .map((boxes) => {
                        const tkhdBox = boxes.find(({ name }) => name === 'tkhd');
                        const mdiaBox = boxes.find(({ name }) => name === 'mdia');
                        return [tkhdBox, mdiaBox];
                    })
                    .filter(([tkhdBox, mdiaBox]) => tkhdBox && mdiaBox)
                    .map(([tkhdBox, mdiaBox]) => {
                        const header = parseTkhdBox(tkhdBox.data);
                        const mdiaBoxes = parseBoxes(mdiaBox.data);
                        const mdhdBox = mdiaBoxes.find(({ name }) => name === 'mdhd');
                        const minfBox = mdiaBoxes.find(({ name }) => name === 'minf');
                        return [header, mdhdBox, minfBox];
                    })
                    .filter(([, mdhdBox, minfBox]) => mdhdBox && minfBox)
                    .map(([header, mdhdBox, minfBox]) => {
                        const info = parseMdhdBox(mdhdBox.data);
                        const minfBoxes = parseBoxes(minfBox.data);
                        const type = minfBoxes.find(({ name }) => Object.keys(BOX_NAME_TYPE_MAP).includes(name));
                        const stblBox = minfBoxes.find(({ name }) => name === 'stbl');
                        return [header, info, type, stblBox];
                    })
                    .filter(([,, type, stblBox]) => type && stblBox)
                    .map(([header, info, type, stblBox]) => {
                        const stblBoxes = parseBoxes(stblBox.data);
                        const stsdBox = stblBoxes.find(({ name }) => name === 'stsd');
                        return [header, info, type, stsdBox];
                    })
                    .filter(([,,, stsdBox]) => stsdBox)
                    .map(([header, info, type, stsdBox]) => {
                        const codecs = parseStsdBox(stsdBox.data);
                        const codec = codecs.entries[0].name;
                        return [header, info, type, codec];
                    });

                resolve();
            }
        } catch(e) {
            reject(`Failed to parse buffer: ${e.message}`);
        }
    });

    const finish = () => new Promise((resolve, reject) => {
        try {
            const tracks = tracksData.map(([header, info, type, codec]) => ({
                id: header.id,
                type: BOX_NAME_TYPE_MAP[type.name],
                lang: info.language,
                codec,
            }));

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
