const BuzzFont = require("./dist/index.js").BuzzFont;
const express = require("express");
const http = require("http");

const PORT = 3000;
const PUBLIC_URL = `http://localhost:${PORT}`;
const APIKEY = "YOUR GOOGLE KEY HERE";


const fontDB = new BuzzFont({
    apiKey: APIKEY,
    baseURL: PUBLIC_URL,
    ready: () => {
        const app = express();
        app.use("/previews", express.static("./previews"));

        app.get("/search", (req, res) => {
            const q = fontDB.nSQL().query("select");

            if (req.query.name) {
                q.where(["family", "LIKE", req.query.name]);
            }
            
            if (req.query.orderBy && req.query.dir) {
                let order = {};
                order[req.query.orderBy] = req.query.dir;
                q.orderBy(order);
            }

            q.exec().then((rows) => {
                res.send(rows).end();
            });
        });

        app.get("/types", (req, res) => {
            const q = fontDB.nSQL().query("select");

            if (req.query.name) {
                q.where(["category", "=", req.query.name]);
            }
            
            if (req.query.orderBy && req.query.dir) {
                let order = {};
                order[req.query.orderBy] = req.query.dir;
                q.orderBy(order);
            }

            q.exec().then((rows) => {
                res.send(rows).end();
            });
        });

        const server = http.createServer(app);
        server.listen(PORT, () => {
            console.log("Server listening on %d", PORT);
        });
    }
});