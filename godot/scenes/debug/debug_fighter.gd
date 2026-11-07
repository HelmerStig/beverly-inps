extends Node2D
## Catalog-driven locomotion with pose-specific hurt geometry.
const SHADER := preload("res://shaders/debug_fighter.gdshader")
const HURTBOX_RIG := preload("res://scenes/debug/hurtbox_rig.gd")
const LOCOMOTION := preload("res://scenes/debug/locomotion.gd")
static var movement_contacts: Dictionary = {}
var data: Dictionary
var world_x := 0.0
var flipped := false
var elapsed := 0.0
var frozen := false
var sprite: Sprite2D
var shadow_sprite: Sprite2D
var stage_scale := 1.0
var anchor := Vector2.ZERO
var frame_index := 0
var effects_enabled := true
var hurtboxes: Area2D
var motion := LOCOMOTION.new()
var animation_id := "idle"
var animation: Dictionary
var visual_scale := 1.0
var hurtbox_frame := 0

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	shadow_sprite = _make_sprite(true)
	sprite = _make_sprite(false)
	hurtboxes = HURTBOX_RIG.new()
	hurtboxes.name = "Hurtboxes"
	add_child(hurtboxes)

func _make_sprite(is_shadow: bool) -> Sprite2D:
	var node := Sprite2D.new()
	node.name = "Shadow" if is_shadow else "Idle"
	node.centered = false
	node.region_enabled = true
	node.region_filter_clip_enabled = true
	var material := ShaderMaterial.new()
	material.shader = SHADER
	material.set_shader_parameter("shadow", is_shadow)
	node.material = material
	add_child(node)
	return node

func select_character(character: Dictionary) -> void:
	data = character
	motion.reset()
	if movement_contacts.is_empty():
		movement_contacts = JSON.parse_string(FileAccess.get_file_as_string("res://data/movement-contacts.json"))
	elapsed = 0.0
	var idle: Dictionary = data.idle
	anchor = Vector2(idle.normalizedPreview.anchor[0], idle.normalizedPreview.anchor[1])
	stage_scale = float(idle.normalizedPreview.scale[0]) * (float(data.heightCm) / 165.0) * (4.0 / 3.0)
	hurtboxes.select_character(character,anchor)
	set_animation("idle",true)

func set_animation(id: String, force: bool = false) -> void:
	if animation_id==id and not force:
		return
	animation_id = id
	animation = data.animations[id]
	elapsed = 0.0
	anchor = Vector2(animation.normalizedPreview.anchor[0],animation.normalizedPreview.anchor[1])
	visual_scale = float(animation.normalizedPreview.scale[0]) * (float(data.heightCm)/165.0) * (4.0/3.0)
	hurtboxes.select_animation(data,id,anchor)
	var texture := load("res://" + str(animation.image)) as Texture2D
	sprite.texture = texture
	shadow_sprite.texture = texture
	sprite.offset = -anchor
	shadow_sprite.offset = -anchor
	_update_frame()

func animation_duration(id: String) -> float:
	var a: Dictionary = data.animations[id]
	if a.has("frameDurations"):
		var total := 0.0
		for duration: float in a.frameDurations:
			total += duration/1000.0
		return total
	return a.frames.size()/float(a.playbackFps)

func locomotion_step(axis: float, delta: float) -> float:
	var distance := motion.step(axis,flipped,delta,animation_duration("back-jump"))
	set_animation(motion.state)
	return distance

func reset_motion() -> void:
	motion.reset()
	set_animation("idle",true)

func _feet() -> Array:
	var feet: Array = movement_contacts[data.id][animation_id][frame_index]
	return feet if not feet.is_empty() else [{"x":anchor.x,"y":anchor.y,"width":36.0}]

func _process(delta: float) -> void:
	if not frozen:
		elapsed += delta
	if not data.is_empty():
		_update_frame()

func _update_frame() -> void:
	var duration := animation_duration(animation_id)
	var clock := minf(elapsed,duration-0.000001) if animation_id=="back-jump" else fposmod(elapsed,duration)
	frame_index = 0
	if animation.has("frameDurations"):
		while frame_index<animation.frames.size()-1 and clock>=float(animation.frameDurations[frame_index])/1000.0-0.0000001:
			clock -= float(animation.frameDurations[frame_index])/1000.0
			frame_index += 1
	else:
		frame_index = mini(int(floor(clock*float(animation.playbackFps)+0.0000001)),animation.frames.size()-1)
	var cell: Array = animation.frames[frame_index]
	var region := Rect2(cell[0], cell[1], cell[2], cell[3])
	sprite.region_rect = region
	shadow_sprite.region_rect = region
	var flip := -1.0 if flipped else 1.0
	sprite.scale = Vector2(visual_scale * flip, visual_scale)
	hurtboxes.scale = sprite.scale
	hurtbox_frame = frame_index
	hurtboxes.update_frame(hurtbox_frame)
	var feet := _feet()
	var bottom := -INF
	for foot: Dictionary in feet:
		bottom = maxf(bottom,float(foot.y))
	# A raised leg is not a second ground contact. Fitting a ground plane through
	# both feet while running produced steep/alternating slopes and rotating shadows.
	var slope := 0.0
	var attached := animation_id in ["idle","walk","backwalk"]
	if attached and feet.size()==2 and absf(float(feet[1].x)-float(feet[0].x))>40.0:
		var candidate := (float(feet[1].y)-float(feet[0].y))/(float(feet[1].x)-float(feet[0].x))
		# Only use a two-sole plane when well-conditioned. A nearly vertical pair
		# is a raised leg, not a ground slope: anchor to the lower sole instead.
		if absf(candidate)<=0.3:
			slope = candidate
	var offset := float(feet[0].y)-anchor.y-slope*(float(feet[0].x)-anchor.x) if slope!=0.0 else bottom-anchor.y
	# Walking soles are not necessarily at the normalized anchor's Y. Preserve
	# their actual sprite positions instead of forcing the shadow onto anchor Y.
	var ground_factor := 1.11 if attached else 0.11
	shadow_sprite.transform = Transform2D(Vector2(visual_scale*(flip+0.5*slope),visual_scale*slope*1.11),Vector2(-0.5*visual_scale,-0.11*visual_scale),Vector2(0.5*visual_scale*offset,visual_scale*offset*ground_factor))
	shadow_sprite.modulate.a = clampf(1.0-maxf(0.0,anchor.y-bottom)/220.0,0.55,1.0)
	shadow_sprite.visible = effects_enabled
	(sprite.material as ShaderMaterial).set_shader_parameter("effects_enabled", effects_enabled)
	queue_redraw()

func _draw() -> void:
	if data.is_empty() or not effects_enabled:
		return
	var flip := -1.0 if flipped else 1.0
	var feet := _feet()
	var bottom := -INF
	for foot: Dictionary in feet:
		bottom = maxf(bottom,float(foot.y))
	for foot: Dictionary in feet:
		var attached := animation_id in ["idle","walk","backwalk"]
		if not attached and (bottom<anchor.y-12.0 or float(foot.y)<bottom-6.0):
			continue
		var x := flip * visual_scale * (float(foot.x) - anchor.x)
		var y := visual_scale * (float(foot.y)-anchor.y) if attached else 0.0
		var width := clampf(float(foot.width) * visual_scale, 24.0, 100.0)
		for index in range(3):
			var ratio := 1.0 if index == 1 else 0.75
			draw_rect(Rect2(x - width * ratio / 2.0, y - 2 + index * 2, width * ratio, 2), Color(29.0/255,22.0/255,37.0/255,0.224))
