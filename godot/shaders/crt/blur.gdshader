// Generated from demo-moves-sanmauro/crt-webgl.js.
shader_type canvas_item;
render_mode unshaded, blend_disabled;


uniform sampler2D source_image : filter_linear, repeat_disable;
uniform vec2 resolution;
vec3 linearColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
vec3 displayColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}
uniform vec2 direction;
uniform float radius;
void fragment(){
  vec3 c=vec3(0.0);float total=0.0;
  for(int i=-4;i<=4;i++){
    float weight=exp(-float(i*i)/8.0);
    c+=texture(source_image,UV+direction*float(i)*radius/resolution).rgb*weight;total+=weight;
  }COLOR=vec4(c/total,1.0);
}