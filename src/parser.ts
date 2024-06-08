enum TrackType {
    Video = 'video',
    Audio = 'audio',
    Text = 'text',
};

type Track = {
    id: number | null;
    type: TrackType | null;
    lang: string | null;
    codec: string | null;
};

interface Parser {
    _decode(chunk: Buffer, onSkip: (start: number, end?: number) => void): Promise<any>;
    _format(decoded: any): Promise<Track[]>;
}

class Parser {
    signature: string;
    signatureOffset: number;

    constructor(signature: string, signatureOffset: number) {
        this.signature = signature;
        this.signatureOffset = signatureOffset;
    }

    compare(chunk: Buffer) {
        const signatureBuffer = Buffer.from(this.signature, 'hex');
        const bufferToCompare = chunk.subarray(
            this.signatureOffset,
            signatureBuffer.length + this.signatureOffset,
        );

        return Buffer.compare(signatureBuffer, bufferToCompare) === 0;
    }

    async decode(chunk: Buffer, onSkip: (start: number, end?: number) => void) {
        try {
            const decoded = await this._decode(chunk, onSkip);
            return Promise.resolve(decoded);
        } catch (e) {
            console.error(e);
            return Promise.reject('Failed to decode buffer');
        }
    }

    async format(decoded: any) {
        try {
            const formatted = await this._format(decoded);
            return Promise.resolve(formatted);
        } catch(e) {
            console.error(e);
            return Promise.reject('Failed to decode buffer');
        }
    }
}

export {
    Track,
    TrackType,
    Parser,
};