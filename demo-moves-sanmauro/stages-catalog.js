/* Generato da scripts/build-stages.py. */
(function(root){const stages=[
  {
    "id": "piazza-europa",
    "name": "Piazza Europa",
    "width": 2550,
    "height": 1080,
    "viewportWidth": 1920,
    "shadow": {
      "color": "#1d1625",
      "shearX": 0.5,
      "flattenY": 0.11,
      "opacity": 0.72,
      "contactOpacity": 0.28
    },
    "layers": [
      {
        "id": "sky",
        "image": "assets/stages/Piazza Europa/cielo.png",
        "zIndex": 0,
        "width": 2550,
        "height": 1080
      },
      {
        "id": "clouds-far",
        "image": "assets/stages/Piazza Europa/01-nuvole-lontane.png",
        "zIndex": 2,
        "width": 5000,
        "height": 1080,
        "speed": 6,
        "haze": 1
      },
      {
        "id": "clouds-mid",
        "image": "assets/stages/Piazza Europa/02-nuvole-intermedie.png",
        "zIndex": 3,
        "width": 5000,
        "height": 1080,
        "speed": 12,
        "haze": 0.35
      },
      {
        "id": "clouds-near",
        "image": "assets/stages/Piazza Europa/03-nuvole-vicine.png",
        "zIndex": 4,
        "width": 5000,
        "height": 1080,
        "speed": 20
      },
      {
        "id": "foreground",
        "image": "assets/stages/Piazza Europa/piazza-europa.png",
        "zIndex": 4,
        "width": 2550,
        "height": 1080
      }
    ],
    "fighters": [
      {
        "characterId": "arianna",
        "animationId": "idle",
        "x": 675,
        "groundY": 1025,
        "scale": 1.2847805788982258,
        "heightCm": 165,
        "heightMultiplier": 1.0,
        "anchorX": 256.5,
        "anchorY": 428,
        "flipX": false
      },
      {
        "characterId": "oscare",
        "animationId": "idle",
        "x": 1890,
        "groundY": 1025,
        "scale": 1.541524334251607,
        "heightCm": 183,
        "heightMultiplier": 1.1090909090909091,
        "anchorX": 257.5,
        "anchorY": 414,
        "flipX": true
      }
    ]
  },
  {
    "id": "mercato",
    "name": "Mercatò",
    "width": 2550,
    "height": 1080,
    "viewportWidth": 1920,
    "shadow": {
      "color": "#1d1625",
      "shearX": 0.5,
      "flattenY": 0.11,
      "opacity": 0.72,
      "contactOpacity": 0.28
    },
    "layers": [
      {
        "id": "sky",
        "image": "assets/stages/Mercatò/cielo.png",
        "zIndex": 0,
        "width": 2550,
        "height": 1080
      },
      {
        "id": "foreground",
        "image": "assets/stages/Mercatò/mercato.png",
        "zIndex": 4,
        "width": 2550,
        "height": 1080
      }
    ],
    "fighters": [
      {
        "characterId": "lele",
        "animationId": "idle",
        "x": 675,
        "groundY": 1025,
        "flipX": false,
        "scale": 1.5884559884559881,
        "heightCm": 176,
        "heightMultiplier": 1.0666666666666667,
        "anchorX": 283.0,
        "anchorY": 409
      },
      {
        "characterId": "mangler",
        "animationId": "idle",
        "x": 1890,
        "groundY": 1025,
        "flipX": true,
        "scale": 1.4289410963568265,
        "heightCm": 183,
        "heightMultiplier": 1.1090909090909091,
        "anchorX": 259.5,
        "anchorY": 428
      }
    ],
    "shootingStars": true,
    "rain": true,
    "webglClouds": true,
    "lightning": true
  }
];
if(typeof module==="object"&&module.exports)module.exports=stages;else root.STAGES_CATALOG=stages;
})(typeof globalThis!=="undefined"?globalThis:this);
