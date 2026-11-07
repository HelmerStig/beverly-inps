// Generated from demo-moves-sanmauro/crt-webgl.js.
shader_type canvas_item;
render_mode unshaded, blend_disabled;


uniform sampler2D source_image : filter_linear, repeat_disable;
uniform vec2 resolution;
vec3 linearColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
vec3 displayColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}
uniform sampler2D bloom : filter_linear, repeat_disable;
uniform sampler2D original : filter_nearest, repeat_disable;
uniform float bloomIntensity;
uniform float strength;
uniform float distortion;
uniform float vignette;
uniform int blendMode;
void fragment(){
  vec2 q=UV-0.5,p=UV+q*dot(q,q)*distortion*2.0;
  vec3 c=texture(source_image,UV).rgb,b=texture(bloom,clamp(p,0.0,1.0)).rgb*bloomIntensity;
  if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0)c=vec3(0.0);
  else if(bloomIntensity>0.0){
    if(blendMode==0)c=1.0-(1.0-clamp(c,0.0,1.0))*(1.0-clamp(b,0.0,1.0));
    else if(blendMode==1)c=max(c,b);
    else {c+=b;c=c/(1.0+c)*1.35;}
  }
  float edge=smoothstep(0.2,0.72,length(q*vec2(1.05,1.0)));
  c*=1.0-edge*vignette*0.65;
  vec3 processed=clamp(displayColor(c),0.0,1.0);
  COLOR=vec4(mix(texture(original,UV).rgb,processed,strength),1.0);
}