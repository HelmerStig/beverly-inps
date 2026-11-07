extends Node
## Explicit RGBA8 passes preserve the demo's linear-light arithmetic in GL Compatibility.

const SIZE := Vector2i(1920, 1080)
const PRESET_PATH := "res://assets/ui/title-screen/crt-preset.json"
var materials: Dictionary = {}
var viewports: Array[SubViewport] = []
var output: Texture2D
var source: Texture2D
var enabled := true
var clock := 0.0
var frozen := false

func build(input: Texture2D) -> void:
	source = input
	var preset: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(PRESET_PATH))
	var p: Dictionary = preset.settings
	var prepared := _pass("prepare", source, {
		"blurAmount": p.blur, "grainAmount": p.grain, "gammaValue": p.gamma,
		"blackPoint": float(p.blackPoint) / 255, "whitePoint": float(p.whitePoint) / 255,
	})
	var bright := _pass("bright", prepared, {"threshold": p.bloomThreshold})
	var horizontal := _pass("blur", bright, {"direction": Vector2.RIGHT, "radius": p.bloomRadius}, "horizontal")
	var blurred := _pass("blur", horizontal, {"direction": Vector2.DOWN, "radius": p.bloomRadius}, "vertical")
	var crt := _pass("phosphor", prepared, {
		"distortion": p.distortion, "dotScale": p.dotScale, "dotPitch": p.dotPitch,
		"falloff": p.falloff, "brightnessBoost": p.brightnessBoost,
		"glowRadius": p.glowRadius, "glowIntensity": p.glowIntensity,
		"convergenceStrength": p.convergenceStrength,
		"patternType": ["monitor", "tv", "lcd"].find(p.type),
		"redOffset": Vector2(p.redX, p.redY), "blueOffset": Vector2(p.blueX, p.blueY),
	})
	var combined := _pass("combine", crt, {
		"bloom": blurred, "original": source, "bloomIntensity": p.bloomIntensity,
		"strength": preset.strength, "distortion": p.distortion, "vignette": p.vignette,
		"blendMode": ["screen", "light", "hdr"].find(p.blend),
	})
	output = _pass("base", combined, {})

func _pass(shader_name: String, input: Texture2D, parameters: Dictionary, pass_name: String = "") -> Texture2D:
	var viewport := SubViewport.new()
	viewport.name = pass_name if not pass_name.is_empty() else shader_name.capitalize()
	viewport.size = SIZE
	viewport.disable_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.use_hdr_2d = false
	add_child(viewport)
	viewports.append(viewport)
	var rect := TextureRect.new()
	rect.size = Vector2(SIZE)
	rect.texture = input
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/crt/" + shader_name + ".gdshader")
	material.set_shader_parameter("source_image", input)
	material.set_shader_parameter("resolution", Vector2(SIZE))
	for key: String in parameters:
		material.set_shader_parameter(key, parameters[key])
	rect.material = material
	viewport.add_child(rect)
	materials[viewport.name] = material
	return viewport.get_texture()

func _process(delta: float) -> void:
	if not frozen:
		clock += delta
	if materials.has("Prepare"):
		materials.Prepare.set_shader_parameter("time", clock)

func set_enabled(value: bool) -> void:
	enabled = value
	for viewport in viewports:
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if value else SubViewport.UPDATE_DISABLED
