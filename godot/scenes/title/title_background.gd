extends Node2D
## Same cover, layer order, haze and deterministic dust as the UI demo.

const MANIFEST_PATH := "res://assets/ui/title-screen/screen.json"
var manifest_path := MANIFEST_PATH
var camera_x := 660.0
var manifest: Dictionary
var textures: Array[Texture2D] = []
var elapsed := 0.0
var effects_enabled := true
var frozen := false

func _ready() -> void:
	manifest = JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
	for layer: Dictionary in manifest.layers:
		textures.append(load("res://" + str(layer.image)) as Texture2D)
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST

func _process(delta: float) -> void:
	if not frozen:
		elapsed += delta
	queue_redraw()

func _draw() -> void:
	if manifest.is_empty():
		return
	for index in range(manifest.layers.size()):
		var layer: Dictionary = manifest.layers[index]
		var width := float(layer.get("renderWidth", layer.width))
		var speed := float(layer.get("speed", 0.0))
		var x := (float(manifest.width) - width) / 2.0 - camera_x
		if speed > 0.0:
			x -= fposmod(elapsed * speed, width)
			while x + width <= 0.0:
				x += width
		while x < 1920.0:
			draw_texture_rect(textures[index], Rect2(x, 0, width, 1080), false)
			if speed == 0.0:
				break
			x += width
		if effects_enabled and layer.has("haze"):
			_draw_fog(float(layer.haze))
	if effects_enabled:
		_draw_dust()

func _draw_fog(depth: float) -> void:
	for y in range(0, 756, 24):
		var altitude := float(y) / 1080.0
		var weight := 0.12 + altitude / 0.45 * 0.88 if altitude < 0.45 else maxf(0.0, (0.7 - altitude) / 0.25)
		draw_rect(Rect2(0, y, 1920, mini(24, 756 - y)), Color(218.0 / 255, 228.0 / 255, 239.0 / 255, 0.65 * 0.5 * depth * weight))

func _draw_dust() -> void:
	var colors := [Color("d3bd99"), Color("b49d7d"), Color("e1cba7")]
	for i in range(160):
		var life := 4000.0 + (i % 5) * 900.0
		var phase := fposmod(elapsed * 1000.0 + i * 1730.0, life) / life
		var x := fposmod(i * 401.0 + 137.0 - phase * (30.0 + (i % 4) * 12.0), float(manifest.width)) - camera_x
		var y := 1080.0 * (0.96 - (i % 7) * 0.006) - phase * (24.0 + (i % 4) * 12.0)
		var color: Color = colors[i % 3]
		color.a = 0.65 * sin(PI * phase)
		var side := 2 + (i % 3) * 2
		# Browser rounds world X before subtracting the camera.
		draw_rect(Rect2(roundf((x + camera_x) / 2) * 2 - camera_x, roundf(y / 2) * 2, side, side), color)
