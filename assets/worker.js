self.importScripts('https://cdn.jsdelivr.net/npm/idb@7/build/umd.js');

;(async function () {
    self.db = await idb.openDB("map", 2, {
        upgrade(db) {
            const store = db.createObjectStore("tiles", {
                keyPath: "id",
            });
            store.createIndex("latIdx", "latIdx");
            store.createIndex("lonIdx", "lonIdx");
            postMessage("DB Upgraded");
        },
    });
    const tx = db.transaction("tiles", "readwrite");
    const tiles = await tx.store.getAll();
    const updatePromises = tiles.map((tile) => {
        tile.isRendered = false;
        return tx.store.put(tile);
    });
    Promise.all([...updatePromises, tx.done]);
})();

async function waitDB() {
    if (!self.db) {
        await wait();
        if (!self.db)
            await waitDB();
    }
  }
  function wait() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true);
        }, 100);
    });
  }

const TILE_DELTA = 0.05; // 0.1 // degree
const LAT_IDX_MAX = Math.ceil(180 / TILE_DELTA);
const LON_IDX_MAX = Math.ceil(360 / TILE_DELTA);

function getSurroundingTiles({ latIdx, lonIdx }) {
    const indices = [-1, 0, 1];
    const tiles = [];
    for (const latOffset of indices) {
        for (const lonOffset of indices) {
            const newLatIdx = (latIdx + latOffset + LAT_IDX_MAX + 1) % (LAT_IDX_MAX + 1);
            const newLonIdx = (lonIdx + lonOffset + LON_IDX_MAX + 1) % (LON_IDX_MAX + 1);
            tiles.push({ latIdx: newLatIdx, lonIdx: newLonIdx });
        }
    }
    return tiles;
}

self.onmessage = (event) => {
    loadSurroundingTiles(event.data)
}

async function loadSurroundingTiles({ latIdx, lonIdx }) {
    await waitDB();
    // console.log(`in worker has db? ${self.db}`)
    // if (!self.db) return;

    const targetTiles = getSurroundingTiles({ latIdx, lonIdx });
    let errorCount = 0;
    let successTiles = [];
    let errorTiles = [];
    const data = await fetch(`/assets/tilesBy${TILE_DELTA}.json`);
    // const data = await fetch(`../public/tilesBy${CONST.TILE_DELTA}.json`)
    const sampleTiles = await data.json();
    {
        const tx = self.db.transaction("tiles", "readwrite");
        const store = tx.objectStore("tiles");
        await Promise.allSettled(targetTiles.map(async (tile) => {
            const id = `${tile.latIdx}-${tile.lonIdx}`;
            try {
                const existingEntry = await store.get(id);
                if (!existingEntry && Object.keys(sampleTiles).includes(id)) {
                    let buildings = [];
                    for (const building of sampleTiles[id].buildings) {
                        buildings = [
                            ...buildings,
                            {
                                height: building.height === 0 ? 4 : building.height,
                                points: building.points.map((point) => ({
                                    lon: Number(point[0]),
                                    lat: Number(point[1]),
                                })),
                                polygon: null,
                            },
                        ];
                    }
                    await store.add({
                        id: id,
                        latIdx: tile.latIdx,
                        lonIdx: tile.lonIdx,
                        isRendered: false,
                        buildings: buildings,
                    });
                }
                if (existingEntry) {
                    errorTiles.push({ ...tile, message: "already exists" });
                    errorCount += 1;
                }
            }
            catch (error) {
                errorTiles.push({
                    ...tile,
                    message: error.message ?? "unknown error",
                });
                errorCount += 1;
            }
        }));
        await tx.done;
    }
    postMessage({
        status: "done",
        error: errorCount,
        errorTiles,
        successTiles,
        latIdx,
        lonIdx,
    });
}