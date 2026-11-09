extends Area2D
## Live hurt areas (layer 2). F3 controls only the anatomical overlay.
const CONFIG_PATH := "res://data/idle-hurtboxes.json"
static var catalog: Dictionary = {}
static var movement_catalog: Dictionary = {}
const OVERRIDE_PATH := "res://data/manual-hurtboxes.json"
static var overrides: Dictionary = {}
static var overrides_loaded := false
var current_frame := 0
var frame_data: Array = []
var shapes: Array[CollisionShape2D] = []
var shape_pool: Array[CollisionShape2D] = []
var anchor := Vector2.ZERO
var debug_visible := false
var current_parts: Array = []
var animation_id := "idle"
var character_id := ""

func _ready() -> void:
	collision_layer = 2
	collision_mask = 0
	monitoring = false
	monitorable = true
	z_index = 5

func select_character(character: Dictionary, sprite_anchor: Vector2) -> void:
	select_animation(character,"idle",sprite_anchor)

func select_animation(character: Dictionary, id: String, sprite_anchor: Vector2) -> void:
	if catalog.is_empty():
		catalog = JSON.parse_string(FileAccess.get_file_as_string(CONFIG_PATH)).characters
	if movement_catalog.is_empty():
		movement_catalog = JSON.parse_string(FileAccess.get_file_as_string("res://data/movement-hurtboxes.json")).characters
	var entry: Dictionary = catalog[character.id] if id=="idle" else movement_catalog[character.id][id]
	var animation: Dictionary = character.animations[id]
	assert(entry.sourceSha256 == animation.sourceSha256, "Review hurtboxes after replacing animation assets")
	assert(entry.frames.size() == animation.frames.size(), "Hurtbox frame count differs from animation")
	character_id = character.id
	animation_id = id
	frame_data = entry.frames
	anchor = sprite_anchor
	update_frame(0)

func update_frame(index: int) -> void:
	if not overrides_loaded:
		overrides_loaded = true
		if FileAccess.file_exists(OVERRIDE_PATH):
			var saved = JSON.parse_string(FileAccess.get_file_as_string(OVERRIDE_PATH))
			if saved is Dictionary:
				overrides = saved
	current_frame = index
	current_parts = overrides.get(frame_key(index),frame_data[index])
	while shape_pool.size()<current_parts.size():
		var shape := CollisionShape2D.new()
		shape.name = "HurtShape%d" % shape_pool.size()
		shape.shape = CapsuleShape2D.new()
		add_child(shape)
		shape_pool.append(shape)
	shapes.assign(shape_pool.slice(0,current_parts.size()))
	for i in range(shape_pool.size()):
		shape_pool[i].disabled = i>=current_parts.size()
	for i in range(current_parts.size()):
		var capsule: Array = current_parts[i].capsule
		var a := Vector2(capsule[0],capsule[1])-anchor
		var b := Vector2(capsule[2],capsule[3])-anchor
		var shape := shapes[i]
		shape.set_meta("body_part",current_parts[i].id)
		var geometry := shape.shape as CapsuleShape2D
		geometry.radius = float(capsule[4])
		geometry.height = a.distance_to(b) + geometry.radius*2.0
		shape.position = (a+b)/2.0
		shape.rotation = (b-a).angle()-PI/2.0
	queue_redraw()

func frame_key(index: int) -> String:
	return character_id+"/"+animation_id+"/"+str(index)

func edit_parts(parts: Array) -> void:
	overrides[frame_key(current_frame)] = parts.duplicate(true)
	update_frame(current_frame)

func save_overrides() -> Error:
	var file := FileAccess.open(OVERRIDE_PATH,FileAccess.WRITE)
	if file==null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(overrides,"\t")+"\n")
	return OK

func _draw() -> void:
	if not debug_visible:
		return
	for part: Dictionary in current_parts:
		var box: Array = part.capsule
		var a := Vector2(box[0],box[1])-anchor
		var b := Vector2(box[2],box[3])-anchor
		var radius := float(box[4])
		var angle := (b-a).angle()
		var outline := PackedVector2Array()
		for step in range(13):
			outline.append(b+Vector2.from_angle(angle-PI/2.0+step*PI/12.0)*radius)
		for step in range(13):
			outline.append(a+Vector2.from_angle(angle+PI/2.0+step*PI/12.0)*radius)
		var color := Color("49efa5")
		if str(part.id).begins_with("head"):
			color = Color("ffce55")
		elif part.id in ["torso","pelvis"]:
			color = Color("68cfff")
		var fill := color
		fill.a = 0.15
		draw_colored_polygon(outline,fill)
		outline.append(outline[0])
		draw_polyline(outline,color,1.25,true)
