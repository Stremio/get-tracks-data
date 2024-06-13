import { bitsToBytes, bufferToHex, byteToBits } from '@/utils';

export type Element = {
    name: string,
    size: number,
    data: Buffer,
    dataSize: number,
    offset: number,
};

const ELEMENT_IDS_MAP: Record<string, string> = {
    '18538067': 'Segment',
    '1654AE6B': 'Tracks',
    'AE': 'TrackEntry',
    'D7': 'TrackNumber',
    '83': 'TrackType',
    '22B59C': 'Language',
    '22B59D': 'LanguageBCP47',
    '536E': 'Name',
    '86': 'CodecID',
};

const readVarInt = (buffer: Buffer, offset = 0) => {
    const firstByte = buffer[offset];
    const bits = byteToBits(firstByte);
    const length = bits.indexOf('1') + 1;

    const bytes = buffer.subarray(offset, offset + length);

    let value = bits.substring(length, bits.length);
    for (let i = 1; i < bytes.length; i++) {
        value += byteToBits(bytes[i]);
    }

    return {
        value: bitsToBytes(value),
        length,
    };
}

const parseElement = (buffer: Buffer, offset = 0): Element => {
    const id = readVarInt(buffer, offset);
    const dataSize = readVarInt(buffer, offset + id.length);

    const dataOffset = offset + id.length + dataSize.length;
    const data = buffer.subarray(dataOffset, dataOffset + dataSize.value);

    const idHexString = bufferToHex(buffer, offset, id.length);
    const name = ELEMENT_IDS_MAP[idHexString] ?? idHexString;

    const size = id.length + dataSize.length + dataSize.value;

    return {
        name,
        size,
        data,
        dataSize: dataSize.value,
        offset,
    };
};

const parseElements = (buffer: Buffer) => {
    const elements: Element[] = [];

    for (let offset = 0; offset < buffer.length;) {
        const element = parseElement(buffer, offset);
        elements.push(element);

        offset += element.size;
    }

    return elements;
};

export {
    parseElements,
};