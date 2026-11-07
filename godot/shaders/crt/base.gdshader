shader_type canvas_item;
render_mode unshaded, blend_disabled;

uniform sampler2D source_image : filter_linear, repeat_disable;
uniform vec2 resolution = vec2(1920.0, 1080.0);

vec3 over(vec3 base, vec3 ink, float alpha) {
	return mix(base, ink, alpha);
}

void fragment() {
	vec3 c = texture(source_image, UV).rgb;
	// CSS filter order: contrast(1.11) saturate(1.126) brightness(1.08).
	c = (c - 0.5) * 1.11 + 0.5;
	float luma = dot(c, vec3(0.213, 0.715, 0.072));
	c = clamp(mix(vec3(luma), c, 1.126) * 1.08, 0.0, 1.0);
	vec2 pixel = UV * resolution;
	// CSS background images are painted from last to first.
	float channel = mod(floor(pixel.x), 3.0);
	vec3 mask = channel < 0.5 ? vec3(255.0,45.0,30.0) : (channel < 1.5 ? vec3(35.0,255.0,90.0) : vec3(45.0,85.0,255.0));
	c = over(c, mask / 255.0, channel > 0.5 && channel < 1.5 ? 0.0325 : 0.06);
	float row = mod(floor(pixel.y), 4.0);
	if (row < 1.0) c = over(c, vec3(5.0,3.0,12.0)/255.0, 0.19);
	else if (row < 2.0) c = over(c, vec3(230.0,241.0,255.0)/255.0, 0.0225);
	// Ellipse farthest-corner: center .3 to corner 1.0.
	float ellipse = length((UV - 0.5) * 2.0) / sqrt(2.0);
	c = over(c, vec3(10.0,5.0,18.0)/255.0, clamp((ellipse - 0.3)/0.7,0.0,1.0)*0.544);
	float edge = min(min(pixel.x, resolution.x-pixel.x), min(pixel.y,resolution.y-pixel.y));
	c = over(c, vec3(5.0,2.0,12.0)/255.0, 0.5*exp(-edge/10.0));
	c = over(c, vec3(0.0), 0.85*exp(-edge/0.9));
	// Glass highlight, corresponding to the 125-degree CSS gradient.
	vec2 direction = vec2(0.819152, 0.573576);
	float distance = dot(pixel, direction) / dot(resolution, direction);
	c = over(c, vec3(224.0,239.0,255.0)/255.0, 0.1*clamp(1.0-distance/0.38,0.0,1.0));
	if (edge < 1.0) c = over(c, vec3(220.0,235.0,255.0)/255.0, 0.14);
	COLOR = vec4(c,1.0);
}
