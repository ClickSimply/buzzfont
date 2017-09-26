# BuzzFont

Make your own Google Fonts API with some extra features
- Search by any font quality.
- Get PNG previews of each font.
- Generate server side renders of the any text with any font.
- Automitically updated once a day.
- Server Agnostic

# Examples
- Get all serif fonts, ordered by popularity. 
```
http://localhost:3000/types?name=serif&orderBy=popularity&dir=desc
```

- Search for a specific font by name.
```
http://localhost:3000/search?name=roboto
```

- Get all fonts, alphabetically ordered.
```
http://localhost:3000/search?orderBy=family&dir=asc
```

# Quick Start
## 1. Clone this repository:
```
git clone https://github.com/ClickSimply/buzzfont.git
```

## 2. NPM Install
```
cd buzzfeed && npm i
```

## 3. Update Server Details
Open the `sample-server.js` file and upate the details at the top.
```
const PORT = 3000;
const PUBLIC_URL = `http://localhost:${PORT}`;
const APIKEY = "YOUR GOOGLE KEY HERE";
```

## 4. Run Server
```
node sample-server.js
```

The script will generate preview URLs for every font available (over 800), then will start the express server.  The example queries above will work from here.

# Roll Your Own
The library itself doesn't have any expressJS or other server code.  It just handles the indexing of the fonts and other cool stuff.

You can easily embed the library in your own project.  The "sample-server.js" file shows a full working example of the script working with express, a smaller example is below.

## 1. Install BuzzFont
```js
npm i buzzfont --save
```

## 2. Integrate With Your App
```js
const BuzzFont = require("buzzfont").BuzzFont;
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

        // Serve the preview images
        app.use("/previews", express.static("./previews"));

        // Once initilized, the library exposes fontDB.nSQL() as a nanoSQL store containing the fonts
        // Read about how to use nanosql here https://github.com/ClickSimply/Nano-SQL/wiki/2.-Query

        // Handle queries with nanosql
        app.get("/search", (req, res) => { 

            fontDB.nSQL()
                .query("select")
                .where(["family", "LIKE", req.query.name])
                .exec().then((rows) => {
                    res.send(rows).end();
                });

        });

        // Run Server
        http.createServer(app).listen(PORT, () => {
            console.log("Server listening on %d", PORT);
        });
    }
});

```
