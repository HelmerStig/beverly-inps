// Generated from demo-moves-sanmauro/crt-webgl.js.
shader_type canvas_item;
render_mode unshaded, blend_disabled;


uniform sampler2D source_image : filter_linear, repeat_disable;
uniform vec2 resolution;
vec3 linearColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
vec3 displayColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}
uniform float blurAmount;
uniform float grainAmount;
uniform float gammaValue;
uniform float blackPoint;
uniform float whitePoint;
uniform float time;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void fragment(){
  vec3 c=vec3(0.0);float total=0.0;
  if(blurAmount>0.0){
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      float weight=(x==0?2.0:1.0)*(y==0?2.0:1.0);
      c+=texture(source_image,UV+vec2(float(x),float(y))*blurAmount/resolution).rgb*weight;total+=weight;
    }c/=total;
  }else c=texture(source_image,UV).rgb;
  c+=vec3((noise(floor(vec2(UV.x,1.0-UV.y)*resolution)+floor(time*12.0))-0.5)*grainAmount);
  c=clamp((c-vec3(blackPoint))/max(whitePoint-blackPoint,0.005),0.0,1.0);
  c=pow(c,vec3(1.0/max(gammaValue,0.1)));
  COLOR=vec4(linearColor(c),1.0);
}