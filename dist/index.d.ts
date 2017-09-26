import { NanoSQLInstance } from "nano-sql";
import { Promise as LPromise } from "lie-ts";
import { IgoogleFont } from "./IgFont";
export interface IbuzzFont extends IgoogleFont {
    id: string;
    styleURL: string;
    popularity: number;
    previewURL: string;
}
export declare class BuzzFont {
    apiKey: string;
    private _nanoSQL;
    private _chromePage;
    private _baseURL;
    nSQL: (table?: string) => NanoSQLInstance;
    constructor(args: {
        apiKey: string;
        ready?: () => void;
        refreshCache?: number;
        baseURL?: string;
        previewFontSize?: number;
        previewSetWidth?: number;
    });
    private _setupDB();
    renderFont(args: {
        fontFamily: string;
        fontVariant: string;
        text?: string;
        fontSize?: number;
        forceWidth?: number;
    }): LPromise<any>;
    private _generateFontPreview(args);
    private _requestFontUpdate();
}
