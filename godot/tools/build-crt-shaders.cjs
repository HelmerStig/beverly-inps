// Rebuild with: node godot/tools/build-crt-shaders.cjs
// The browser's RGBA8 pipeline is kept as separate Godot render targets.
const fs = require('node:fs');
const path = require('node:path');
const {shaders} = require('../../demo-moves-sanmauro/crt-webgl.js');
const folder = path.resolve(__dirname, '../shaders/crt');
for (const name of ['prepare', 'bright', 'blur', 'phosphor', 'combine']) {
  let code = shaders[name]
    .replace('precision highp float;', '')
    .replace('varying vec2 uv;', '')
    .replace(/uniform sampler2D image;/g, 'uniform sampler2D source_image : filter_linear, repeat_disable;')
    .replace(/\bimage\b/g, 'source_image')
    .replace(/\btexture2D\b/g, 'texture')
    .replace(/\bgl_FragColor\b/g, 'COLOR')
    .replace(/\buv\b/g, 'UV')
    .replace('void main()', 'void fragment()')
    .replace('uniform sampler2D bloom,original;', 'uniform sampler2D bloom : filter_linear, repeat_disable;\nuniform sampler2D original : filter_nearest, repeat_disable;')
    .replace(/uniform (float|vec2|int) ([\w,]+);/g, (_, type, names) => names.split(',').map(name => `uniform ${type} ${name};`).join('\n'))
    // Godot UVs start at the top; WebGL UVs start at the bottom.
    .replace('floor(UV*resolution)', 'floor(vec2(UV.x,1.0-UV.y)*resolution)')
    .replace('maskAt(p*resolution)', 'maskAt(vec2(p.x,1.0-p.y)*resolution)')
    .replace('redOffset/resolution', 'redOffset*vec2(1.0,-1.0)/resolution')
    .replace('blueOffset/resolution', 'blueOffset*vec2(1.0,-1.0)/resolution');
  if (name === 'phosphor') {
    code = code.replace('COLOR=vec4(0.0,0.0,0.0,1.0);return;}', 'COLOR=vec4(0.0,0.0,0.0,1.0);}else{')
      .replace('COLOR=vec4(c,1.0);\n}', 'COLOR=vec4(c,1.0);\n}}');
  }
  fs.writeFileSync(path.join(folder, name + '.gdshader'),
    '// Generated from demo-moves-sanmauro/crt-webgl.js.\nshader_type canvas_item;\nrender_mode unshaded, blend_disabled;\n' + code);
}
