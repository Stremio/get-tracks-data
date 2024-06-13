const byteToBits = (byte: number) => byte.toString(2).padStart(8, '0');
const bitsToBytes = (bits: string) => parseInt(bits, 2);
const bufferToInt = (buffer: Buffer) => parseInt(buffer.toString('hex'), 16);
const bufferToHex = (buffer: Buffer, start: number, length: number) => buffer
    .subarray(start, start + length)
    .toString('hex')
    .toUpperCase();

export {
    byteToBits,
    bitsToBytes,
    bufferToInt,
    bufferToHex,
};