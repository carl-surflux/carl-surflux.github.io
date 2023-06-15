// Create a new CesiumJS application.
var viewer = new Cesium.Viewer('cesiumContainer', {
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
let pointer = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(126.8257072, 37.5678755),
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

viewer.scene.camera.setView({
    destination : Cesium.Cartesian3.fromDegrees(126.8257072, 37.5678755, 2000)
});

// change current position
function showPosition(position) {
    const longitude = position.coords.longitude;
    const latitude = position.coords.latitude;

    viewer.entities.remove(pointer);

    pointer = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
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

    // 현재 높이
    var cameraPosition = viewer.scene.camera.positionWC;
    var ellipsoidPosition = viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(cameraPosition);
    var height = Cesium.Cartesian3.magnitude(Cesium.Cartesian3.subtract(cameraPosition, ellipsoidPosition, new Cesium.Cartesian3()));

    viewer.scene.camera.setView({
        destination : Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    });
}

function err(err) {
    console.log('err! : ', err)
}

const options = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0,
};

if (navigator.geolocation) {
    // ios simulator 에서는 Features > Location 에 None 이 아닌 위치가 잡혀야 나온다
    navigator.geolocation.watchPosition(showPosition, err, options);
} else {
    alert("Geolocation is not supported by this browser.");
    console.log("Geolocation is not supported by this browser.");
}