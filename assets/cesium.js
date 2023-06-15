// Create a new CesiumJS application.
var viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayerPicker: false,
    baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
        url: 'https://tile.surflux.studio/hot/'
    })),
});
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


viewer.scene.screenSpaceCameraController.maximumZoomDistance = 3000;
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;

let label;
function showPosition(position) {
    // 사무실 126.8257072, 37.5678755
    const longitude = position.coords.longitude;
    const latitude = position.coords.latitude;

    if(label){
        viewer.entities.remove(label);
    }

    label = viewer.entities.add({
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

    viewer.scene.camera.setView({
        destination : Cesium.Cartesian3.fromDegrees(longitude, latitude,  2000)
    });

    // viewer.camera.flyTo({
    //     destination : Cesium.Cartesian3.fromDegrees(longitude, latitude,  10000)
    // });
}

function err(err) {
    console.log('err! : ', err)
}

if (navigator.geolocation) {
    // ios simulator 에서는 Features > Location 에 None 이 아닌 위치가 잡혀야 나온다
    navigator.geolocation.getCurrentPosition(showPosition, err);
} else {
    alert("Geolocation is not supported by this browser.");
    console.log("Geolocation is not supported by this browser.");
}