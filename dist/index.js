"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nano_sql_1 = require("nano-sql");
const axios_1 = require("axios");
const lie_ts_1 = require("lie-ts");
const puppeteer = require("puppeteer");
const fs = require("fs");
class BuzzFont {
    constructor(args) {
        this._nanoSQL = new nano_sql_1.NanoSQLInstance();
        this.apiKey = args.apiKey;
        this._baseURL = args.baseURL;
        this.nSQL = (table) => {
            return this._nanoSQL.table(table);
        };
        if (args.refreshCache) {
            setInterval(this._requestFontUpdate, args.refreshCache * 24 * 60 * 60 * 1000);
        }
        let browser;
        if (!fs.existsSync("./previews")) {
            fs.mkdirSync("./previews");
            this._setupDB().then(() => {
                return new lie_ts_1.Promise((res, rej) => {
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
        }
        else {
            this._setupDB().then(args.ready);
        }
    }
    _setupDB() {
        return this.nSQL("fonts")
            .model([
            { key: "id", type: "uuid", props: ["pk"] },
            { key: "popularity", type: "int" },
            { key: "family", type: "string" },
            { key: "category", type: "string" },
            { key: "styleURL", type: "string" },
            { key: "variants", type: "string[]" },
            { key: "subsets", type: "string[]" },
            { key: "version", type: "string" },
            { key: "lastModified", type: "string" },
            { key: "files", type: "map" },
            { key: "previewURL", type: "string" }
        ])
            .config({
            id: "font",
            persistent: true,
            history: false
        })
            .connect();
    }
    renderFont(args) {
        let browser;
        return new lie_ts_1.Promise((res, rej) => {
            puppeteer.launch({
                timeout: 10000
            }).then((br) => {
                browser = br;
                return br.newPage();
            }).then((page) => {
                this._chromePage = page;
                return this._generateFontPreview(Object.assign({}, args, { returnB64: true }));
            }).then((b64) => {
                res(b64);
                browser.close();
            });
        });
    }
    _generateFontPreview(args) {
        return new lie_ts_1.Promise((res, rej) => {
            const rand = nano_sql_1.NanoSQLInstance.uuid();
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
                        });
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
                    fs.readFile(`./previews/${rand}.png`, (err, data) => {
                        fs.unlink(`./previews/${rand}.png`, () => {
                            res(new Buffer(data).toString('base64'));
                        });
                    });
                }
                else {
                    res(`${this._baseURL}/previews/${args.fontFamily.replace(/ /g, "+")}.png`);
                }
            }).catch((err) => {
                res(false);
            });
        });
    }
    _requestFontUpdate() {
        return new lie_ts_1.Promise((res, rej) => {
            axios_1.default.get(`https://www.googleapis.com/webfonts/v1/webfonts?key=${this.apiKey}&sort=popularity`).then((response) => {
                const gFonts = response.data.items;
                nano_sql_1.NanoSQLInstance.chain(gFonts.map((gfont, i) => {
                    return (nextFont) => {
                        this.nSQL("fonts").query("select").where(["family", "=", gfont.family]).exec().then((bzFonts) => {
                            const thisFont = Object.assign({}, gfont, { styleURL: "https://fonts.googleapis.com/css?family=" + gfont.family.replace(/ /g, "+").trim(), popularity: gFonts.length - i });
                            if (!bzFonts.length) {
                                console.log(`Generating Font Preview ${i + 1} of ${gFonts.length} (${gfont.family}), ${Math.round(i / gFonts.length * 100)}%`);
                                this._generateFontPreview({
                                    fontFamily: thisFont.family,
                                    fontVariant: thisFont.variants[0],
                                    forceWidth: 800
                                }).then((url) => {
                                    if (!url) {
                                        return new Promise((res) => res());
                                    }
                                    return this.nSQL("fonts").query("upsert", Object.assign({}, thisFont, { previewURL: url })).exec();
                                }).then(nextFont);
                            }
                            else {
                                this.nSQL("fonts").query("upsert", thisFont).where(["family", "=", gfont.family]).exec().then(nextFont);
                            }
                        });
                    };
                }))(res);
            });
        });
    }
}
exports.BuzzFont = BuzzFont;
