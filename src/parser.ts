interface Parser {
    decode: (chunk: Buffer, onSkip: (start: number, end?: number | undefined) => void) => Promise<any>;
    format: (decoded: any) => Promise<Track[]>;
};

enum TrackType {
    Video = 'video',
    Audio = 'audio',
    Text = 'text',
};

class Track {
    id: number | null;
    type: TrackType | null;
    lang: string | null;
    codec: string | null;

    constructor() {
        this.id = null;
        this.type = null;
        this.lang = null;
        this.codec = null;
    }
};

export {
    Parser,
    Track,
    TrackType,
};