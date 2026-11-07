shader_type canvas_item;
render_mode unshaded;
uniform bool shadow = false;
uniform bool effects_enabled = true;
void fragment() {
	vec4 pixel = texture(TEXTURE, UV);
	if (shadow) {
		COLOR = vec4(vec3(29.0,22.0,37.0)/255.0, pixel.a * 0.576);
	} else {
		COLOR = vec4(mix(pixel.rgb, vec3(255.0,184.0,120.0)/255.0, effects_enabled ? 0.056 : 0.0), pixel.a);
	}
}
