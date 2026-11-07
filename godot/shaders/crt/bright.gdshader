// Generated from demo-moves-sanmauro/crt-webgl.js.
shader_type canvas_item;
render_mode unshaded, blend_disabled;


uniform sampler2D source_image : filter_linear, repeat_disable;
uniform vec2 resolution;
vec3 linearColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
vec3 displayColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}
uniform float threshold;
void fragment(){vec3 c=texture(source_image,UV).rgb;float l=dot(c,vec3(0.2126,0.7152,0.0722));
COLOR=vec4(c*smoothstep(threshold,min(1.01,threshold+0.15),l),1.0);}