// Generated from demo-moves-sanmauro/crt-webgl.js.
shader_type canvas_item;
render_mode unshaded, blend_disabled;


uniform sampler2D source_image : filter_linear, repeat_disable;
uniform vec2 resolution;
vec3 linearColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
vec3 displayColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}
uniform float distortion;
uniform float dotScale;
uniform float dotPitch;
uniform float falloff;
uniform float brightnessBoost;
uniform float glowRadius;
uniform float glowIntensity;
uniform float convergenceStrength;
uniform int patternType;
uniform vec2 redOffset;
uniform vec2 blueOffset;
vec2 screenUV(vec2 p){vec2 q=p-0.5;return p+q*dot(q,q)*distortion*2.0;}
vec3 readColor(vec2 p){
  vec2 r=redOffset*vec2(1.0,-1.0)/resolution*convergenceStrength,b=blueOffset*vec2(1.0,-1.0)/resolution*convergenceStrength;
  return vec3(texture(source_image,p+r).r,texture(source_image,p).g,texture(source_image,p+b).b);
}
float spot(vec2 local,vec2 halfSize){
  float softness=max(0.02,falloff);
  vec2 edge=1.0-smoothstep(halfSize*(1.0-softness),halfSize,abs(local));
  return edge.x*edge.y;
}
vec3 maskAt(vec2 pixel){
  float pitch=max(dotPitch,1.0),scale=clamp(dotScale,0.05,1.8);
  if(patternType==0){
    vec2 cell=vec2(pitch,pitch);float col=floor(pixel.x/cell.x);
    vec2 p=pixel-vec2(0.0,mod(col,2.0)*pitch*0.5);
    vec2 local=mod(p,cell)-cell*0.5;
    float dots=1.0-smoothstep(pitch*scale*0.5*(1.0-max(falloff,0.02)),pitch*scale*0.5,length(local));
    float channel=mod(floor(p.y/pitch)+col,3.0);
    return vec3(channel<0.5?dots:0.0,channel>0.5&&channel<1.5?dots:0.0,channel>1.5?dots:0.0);
  }
  float cellWidth=pitch/3.0,col=floor(pixel.x/cellWidth);
  float shift=patternType==1?mod(floor(pixel.x/pitch),2.0)*pitch*0.5:0.0;
  vec2 local=mod(pixel-vec2(0.0,shift),vec2(cellWidth,pitch))-vec2(cellWidth,pitch)*0.5;
  float dots=spot(local,vec2(cellWidth*0.46,pitch*0.43)*scale);
  float channel=mod(col,3.0);
  return vec3(channel<0.5?dots:0.0,channel>0.5&&channel<1.5?dots:0.0,channel>1.5?dots:0.0);
}
vec3 emit(vec2 p){if(dotScale<=0.0||dotPitch<=0.0)return readColor(p)*brightnessBoost;return readColor(p)*(vec3(0.32)+maskAt(vec2(p.x,1.0-p.y)*resolution)*2.05)*brightnessBoost;}
void fragment(){
  vec2 p=screenUV(UV);
  if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0){COLOR=vec4(0.0,0.0,0.0,1.0);}else{
  vec3 c=emit(p);
  if(glowIntensity>0.0&&glowRadius>0.0){
    vec3 glow=vec3(0.0);
    for(int i=0;i<8;i++){
      float angle=float(i)*0.785398163;
      vec2 offset=vec2(cos(angle),sin(angle))*glowRadius*max(dotPitch,1.0)/resolution;
      glow+=emit(p+offset);
    }c=mix(c,glow/8.0,glowIntensity*0.65);
  }COLOR=vec4(c,1.0);
}}