import { NanoSQLInstance } from "nano-sql";
import Axios from "axios";
import { Promise as LPromise } from "lie-ts";
import { IgoogleFont } from "./IgFont";
import * as puppeteer from "puppeteer";
import * as fs from "fs";

export interface IbuzzFont extends IgoogleFont {
    id: string;
    styleURL: string;
    popularity: number;
    previewURL: string;
}

export class BuzzFont {

    public apiKey: string;

    private _nanoSQL: NanoSQLInstance;

    private _chromePage: any;

    private _baseURL: string;

    public nSQL: (table?: string) => NanoSQLInstance;

    constructor(args: {
        apiKey: string;
        ready?: () => void;
        refreshCache?: number; // days
        baseURL?: string;
        previewFontSize?: number;
        previewSetWidth?: number;
    }) {

        this._nanoSQL = new NanoSQLInstance();
        this.apiKey = args.apiKey

        this._baseURL = args.baseURL;
        
        this.nSQL = (table?: string) => {
            return this._nanoSQL.table(table);
        };

        if (args.refreshCache) {
            setInterval(this._requestFontUpdate, args.refreshCache * 24 * 60 * 60 * 1000);
        }

        let browser: any;

        if (!fs.existsSync("./previews")) {
            fs.mkdirSync("./previews");
            this._setupDB().then(() => {
                return new LPromise((res, rej) => {
                    puppeteer.launch({
                        timeout: 1000
                    }).then((br) => {
                        browser = br;
                        return br.newPage();
                    }).then((page) => {
                        this._chromePage = page;
                        res();
                    });
                });
            }).then(() => {
                return this._requestFontUpdate();
            }).then(() => {
                return browser.close();
            }).then(args.ready);
        } else {
            this._setupDB().then(args.ready);
        }
    }

    private _setupDB(): LPromise<any> {

        return this.nSQL("fonts")
        .model([
            {key: "id", type: "uuid", props: ["pk"]},
            {key: "popularity", type: "int"},
            {key: "family", type: "string"},
            {key: "category", type: "string"},
            {key: "styleURL", type: "string"},
            {key: "variants", type: "string[]"},
            {key: "subsets", type: "string[]"},
            {key: "version", type: "string"},
            {key: "lastModified", type: "string"},
            {key: "files", type: "map"},
            {key: "previewURL", type: "string"}
        ])
        .config({
            id: "font",
            persistent: true,
            history: false
        })
        .connect();
    }

    public renderFont(args: {
        fontFamily: string, 
        fontVariant: string,
        text?: string,
        fontSize?: number,
        forceWidth?: number, 
    }): LPromise<any> {
        let browser: any;
        return new LPromise((res, rej) => {
            puppeteer.launch({
                timeout: 10000
            }).then((br) => {
                browser = br;
                return br.newPage();
            }).then((page) => {
                this._chromePage = page;
                return this._generateFontPreview({
                    ...args,
                    returnB64: true
                });
            }).then((b64) => {
                res(b64);
                browser.close();
            });
        });
    }

    private _generateFontPreview(args: {
        fontFamily: string, 
        fontVariant: string,
        text?: string,
        fontSize?: number,
        returnB64?: boolean;
        forceWidth?: number,
    }): LPromise<any> {
        return new LPromise((res, rej) => {
            const rand = NanoSQLInstance.uuid();

            args.text = args.text || "The quick brown fox jumps over the lazy dog.";
            args.fontSize = args.fontSize || 30;
            this._chromePage.setViewport({ width: args.forceWidth || 800, height: 600 }).then(() => {
                return this._chromePage.setContent(`<html>
                        <head>
                        <script src="https://cdnjs.cloudflare.com/ajax/libs/webfont/1.6.28/webfontloader.js"></script>
                        <script>
                            WebFont.load({
                                google: {
                                    families: ["${args.fontFamily}:${args.fontVariant}"]
                                },
                                active: () => {
                                    document.body.style.fontFamily = "${args.fontFamily}";
                                    document.body.classList.add("ready");
                                }
                            });
                        </script>
                    </head>
                    <body style="margin:0px;font-size:${args.fontSize}px"><div class="text" style="padding:5px;display:inline-block;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;">${args.text}<div></body>
                    </html>`);
            }).then(() => {
                return this._chromePage.waitForSelector("body.ready");
            }).then(() => {
                return this._chromePage.evaluate(() => {
                    return new Promise((res, rej) => {
                        res({
                            width: document.querySelector(".text").clientWidth,
                            height: document.querySelector(".text").clientHeight
                        })
                    });
                });
            }).then((resolution) => {
                return this._chromePage.setViewport({
                    width: args.forceWidth ? args.forceWidth : resolution.width,
                    height: resolution.height
                });
            }).then(() => {
                return this._chromePage.screenshot({ path: args.returnB64 ? `./previews/${rand}.png` : `./previews/${args.fontFamily.replace(/ /g, "+")}.png` });
            }).then(() => {
                if (args.returnB64) {
                        // read binary data
                        fs.readFile(`./previews/${rand}.png`, (err, data) => {
                            fs.unlink(`./previews/${rand}.png`, () => {
                                res(new Buffer(data).toString('base64'));
                            });
                        });
                } else {
                    res(`${this._baseURL}/previews/${args.fontFamily.replace(/ /g, "+")}.png`);
                }
            }).catch((err) => {
                res(false);
            });
        });
    }

    private _requestFontUpdate(): LPromise<any> {
        return new LPromise((res, rej) => {
            Axios.get(`https://www.googleapis.com/webfonts/v1/webfonts?key=${this.apiKey}&sort=popularity`).then((response) => {
                const gFonts: IgoogleFont[] = response.data.items;
                NanoSQLInstance.chain(gFonts.map((gfont, i) => {
                    return (nextFont) => {
                        this.nSQL("fonts").query("select").where(["family", "=", gfont.family]).exec().then((bzFonts: IbuzzFont[]) => {
                            const thisFont = {
                                ...gfont,
                                styleURL: "https://fonts.googleapis.com/css?family=" + gfont.family.replace(/ /g,"+").trim(),
                                popularity: gFonts.length - i
                            };
                            
                            if (!bzFonts.length) {
                                console.log(`Generating Font Preview ${i + 1} of ${gFonts.length} (${gfont.family}), ${Math.round(i/gFonts.length * 100)}%`)
                                this._generateFontPreview({
                                    fontFamily: thisFont.family,
                                    fontVariant: thisFont.variants[0],
                                    forceWidth: 800
                                }).then((url) => {
                                    if (!url) {
                                        return new Promise((res) => res());
                                    }
                                    return this.nSQL("fonts").query("upsert", {
                                        ...thisFont,
                                        previewURL: url
                                    }).exec();
                                }).then(nextFont);
                                
                            } else {
                                this.nSQL("fonts").query("upsert", thisFont).where(["family", "=", gfont.family]).exec().then(nextFont);
                            }
                        });
                    }
                }))(res);
            });
        });
    }
}