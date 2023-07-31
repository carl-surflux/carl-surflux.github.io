// const CESIUM_BASE_URL = "/Cesium/";
// const DEFAULT_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjZjQzMmJjNi1iNTQ1LTQyYmUtYThmZC1iZmMwN2NjNGM4MjkiLCJpZCI6MTQyNTg2LCJpYXQiOjE2ODU0MTM2MjB9.n_r6Pl2h5ip36Oe-Pp-v_B-rHpksulq14iSDvF34LQo";
const RENDER_THRESHOLD_CAMERA_HEIGHT = 3000; // 30000 // Distance threshold for rendering polygons
const TILE_DELTA = 0.05; // 0.1 // degree
const LAT_IDX_MAX = Math.ceil(180 / TILE_DELTA);
const LON_IDX_MAX = Math.ceil(360 / TILE_DELTA);
const BUILDING_AMOUNT_EACH_TILE = 1000; // 1000 // amount
const BUILDING_LENGTH = 0.0003; // 0.01 // degree
const BULIDING_HEIGHT_MIN = 30; // 30 // m
const BUILDING_HEIGHT_MAX = 130; // 130 // m

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
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}
function radianToDegree(radian) {
    return radian * (180 / Math.PI);
}
function latDegreeTolatIdx(lat) {
    return Math.floor((lat + 90) / TILE_DELTA);
}
function lonDegreeTolonIdx(lon) {
    return Math.floor((lon + 180) / TILE_DELTA);
}
function latIdxTolatDegree(latIdx) {
    return latIdx * TILE_DELTA - 90;
}
function lonIdxTolonDegree(lonIdx) {
    return lonIdx * TILE_DELTA - 180;
}

let globalCurrentTile = { latIdx: 0, lonIdx: 0 };
let globalTileSet = {};
let renderedEntities = {};
let previousTile = { latIdx: 0, lonIdx: 0 };
let loadingWorker;

let viewer;
let pointer;
let longitude = 126.8257072;
let latitude = 37.5678755;

let watchID;

function goCesium() {
    // Create a new CesiumJS application.
    viewer = new Cesium.Viewer('cesiumContainer', {
        baseLayerPicker: false,
            baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.surflux.studio/hot/'
            })),
    });

    // remove toolbar
    viewer.animation.destroy()
    viewer.homeButton.destroy()
    viewer.navigationHelpButton.destroy()
    viewer.clockViewModel.destroy()
    viewer.creditDisplay.destroy()
    viewer.fullscreenButton.destroy()
    viewer.geocoder.destroy()
    viewer.infoBox.destroy()
    viewer.sceneModePicker.destroy()
    viewer.timeline.destroy()

    // set zoom level
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 3000;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;

    // set default camera
    // 사무실 126.8257072, 37.5678755
    viewer.camera.setView({
        destination : Cesium.Cartesian3.fromDegrees(longitude, latitude, 2000)
    });
    // set initial tileIdx
    globalCurrentTile = getCurrentTile();
    
    loadingWorker = new Worker("/assets/worker.js");
    loadingWorker.onmessage = (event) => {
        console.log("Done message from loading worker:", event.data);
        if (isCameraHeightWithinThreshold()) {
            console.time("render!");
            const { latIdx, lonIdx } = event.data;
            renderSurroundings({ latIdx, lonIdx });
            console.timeEnd("render!");
        }
        if (isCameraHeightAboveThreshold()) {
            console.time("removeall!");
            removeAllTiles();
            console.timeEnd("removeall!");
        }
    };
    loadingWorker.postMessage(globalCurrentTile);

    viewer.camera.changed.addEventListener(onChangeTile);


    if (navigator.geolocation) {
        // ios simulator 에서는 Features > Location 에 None 이 아닌 위치가 잡혀야 나온다
        setGeoSetting()
    } else {
        alert("Geolocation is not supported by this browser.");
        // console.log("Geolocation is not supported by this browser.");
    }
}

function err(err) {
    // alert('err! : ', err)
    console.log('err! : ', err)
}

const options = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0,
};

async function setGeoSetting() {
    watchID = navigator.geolocation.watchPosition(setPosition, err, options);
    const permissionStatus = await navigator.permissions.query({name:'geolocation'})
    handlePermission(permissionStatus.state)
    permissionStatus.onchange = function() {
        handlePermission(permissionStatus.state)
    }
}

function handlePermission(state) {
    if (state === 'granted') {
        if (!pointer)
            pointer = viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 500),
                label: {
                    text: "*",
                    scale: 1,
                    pixelOffset: new Cesium.Cartesian2(0, 0),
                    font: "32px Helvetica",
                    fillColor: Cesium.Color.YELLOW,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                }
            });
        
        if (watchID)
            return
        
        watchID = navigator.geolocation.watchPosition(setPosition, err, options);
    } else {
        if (pointer)
            viewer.entities.remove(pointer);
        
        navigator.geolocation.clearWatch(watchID);
        watchID = null;
    }
}

// change current position
function setPosition(position) {
    if (!viewer || !pointer) return;

    // alert('show me position')
    longitude = position.coords.longitude;
    latitude = position.coords.latitude;

    viewer.entities.remove(pointer);

    pointer = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 500),
        label: {
            text: "*",
            scale: 1,
            pixelOffset: new Cesium.Cartesian2(0, 0),
            font: "32px Helvetica",
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        }
    });
}

function findMe() {
    if (!viewer || !longitude || !latitude) return;

    // 현재 높이
    var cameraPosition = viewer.scene.camera.positionWC;
    var ellipsoidPosition = viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(cameraPosition);
    var height = Cesium.Cartesian3.magnitude(Cesium.Cartesian3.subtract(cameraPosition, ellipsoidPosition, new Cesium.Cartesian3()));

    // viewer.scene.camera.setView({
    viewer.camera.flyTo({
        destination : Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    });

    window.parent && window.parent.postMessage('찾았다!','*');
}

async function getData() {
    const response = await fetch('http://localhost:8000')
    const jsonData = await response.json()
    console.log(jsonData)
}

function onChangeTile() {
    // TODO: zoom 빠졌다가 다시 들어갔을때 render
    // TODO: camera position -> screen center ray position
    // logCameraPosition()
    const previousTile = cloneObject(globalCurrentTile);
    globalCurrentTile = getCurrentTile();
    if (hasTileChanged(previousTile, globalCurrentTile)) {
        // TODO: 사실상 이 부분에서 load async 하게 요청, 아래 render 부분은 load가 끝난후 try.
        loadingWorker.postMessage(globalCurrentTile);
        console.time("load!");
        // loadSurroundingTiles(globalCurrentTile)
        console.timeEnd("load!");
        console.log(JSON.stringify({ globalCurrentTile, previousTile }));
    }
}
function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function hasTileChanged(previousTile, currentTile) {
    return (previousTile.latIdx !== currentTile.latIdx ||
        previousTile.lonIdx !== currentTile.lonIdx);
}
function isCameraHeightWithinThreshold() {
    const { height } = viewer.camera.positionCartographic;
    return height <= RENDER_THRESHOLD_CAMERA_HEIGHT;
}
function isCameraHeightAboveThreshold() {
    const { height } = viewer.camera.positionCartographic;
    return height > RENDER_THRESHOLD_CAMERA_HEIGHT;
}
function removeAllTiles() {
    viewer.entities.removeAll();
    for (const latIdx in globalTileSet) {
        for (const lonIdx in globalTileSet[latIdx]) {
            if (globalTileSet[latIdx][lonIdx].isRendered === true) {
                for (const building of globalTileSet[latIdx][lonIdx].buildings) {
                    //   delete building.polygon
                }
            }
        }
    }
}
function getCurrentTile() {
    let latIdx = 0;
    let lonIdx = 0;
    const lat = Cesium.Math.toDegrees(viewer.camera.positionCartographic.latitude);
    const lon = Cesium.Math.toDegrees(viewer.camera.positionCartographic.longitude);
    latIdx = latDegreeTolatIdx(lat);
    lonIdx = lonDegreeTolonIdx(lon);
    const returns = { latIdx, lonIdx };
    return returns;
}
async function renderSurroundings(currentTile) {
    /**
     * 현재 타일과 주변 8개 총 9개 타일을 렌더합니다. isRendered가 false 일때만 렌더합니다.
     */
    await waitDB();
    const tx = db.transaction("tiles", "readwrite");
    const currentTiles = getSurroundingTiles(currentTile);
    for (const tile of currentTiles) {
        const key = `${tile.latIdx}-${tile.lonIdx}`;
        const tileInfo = await tx.store.get(key);
        // const material = generateRandomColor()
        const material = Cesium.Color.WHITE;
        if (tileInfo?.isRendered === false) {
            for (const building of tileInfo.buildings) {
                const polygon = new Cesium.Entity({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy(Cesium.Ellipsoid.WGS84.cartographicArrayToCartesianArray(building.points.map((point) => Cesium.Cartographic.fromDegrees(point.lon, point.lat)))),
                        material,
                        perPositionHeight: true,
                        extrudedHeight: building.height,
                    },
                });
                if (renderedEntities[key] === undefined)
                    renderedEntities[key] = [polygon];
                else
                    renderedEntities[key].push(polygon);
                viewer.entities.add(polygon);
            }
            tileInfo.isRendered = true;
            await tx.store.put(tileInfo);
        }
    }
    /**
     * 기존 타일과 주변 8개 총 9개 중, 현재 타일과 주변 타일에 해당하지 않는 타일을 디렌더합니다.
     */
    const previousTiles = getSurroundingTiles(previousTile);
    const filteredTargetTiles = previousTiles.filter((prev) => currentTiles.every((cur) => cur.latIdx !== prev.latIdx || cur.lonIdx !== prev.lonIdx));
    for (const tile of filteredTargetTiles) {
        const key = `${tile.latIdx}-${tile.lonIdx}`;
        const targetTile = await tx.store.get(key);
        if (targetTile === undefined) {
            continue;
        }
        targetTile.isRendered = false;
        for (const polygon of renderedEntities[key] || []) {
            viewer.entities.remove(polygon);
        }
        delete renderedEntities[key];
        await tx.store.put(targetTile);
    }
    await tx.done;
    previousTile = currentTile;
}

function receiveMessage(event) {
    event.source.postMessage(
      `안녕 ${event.data}, 난 자식이야`,
      '*',
    );
  }
  
  window.addEventListener("message", receiveMessage, false);



