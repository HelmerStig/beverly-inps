extends Area2D
static var catalog: Dictionary = {}
var config: Dictionary
var shape: CollisionShape2D
var anchor := Vector2.ZERO
var capsule: Array = []
var active := false
var debug_visible := false

func _ready() -> void:
	collision_layer = 4
	collision_mask = 2
	monitoring = false
	monitorable = true
	z_index = 6
	shape = CollisionShape2D.new()
	shape.shape = CapsuleShape2D.new()
	shape.disabled = true
	add_child(shape)

func configure(character: Dictionary, sprite_anchor: Vector2) -> void:
	if catalog.is_empty():
		catalog = JSON.parse_string(FileAccess.get_file_as_string("res://data/light-punch-hitboxes.json")).characters
	config = catalog[character.id]
	assert(config.sourceSha256==character.animations["light-punch"].sourceSha256,"Review punch hitbox after changing sprites")
	assert(config.frames.size()==character.animations["light-punch"].frames.size(),"Punch hitbox frame count differs from animation")
	anchor = sprite_anchor
	disable()

func disable() -> void:
	active = false
	if shape!=null:
		shape.disabled = true
	queue_redraw()

func update_frame(index: int, enabled: bool, sprite_scale: Vector2) -> void:
	scale = sprite_scale
	if not enabled or config.frames[index]==null:
		disable()
		return
	capsule = config.frames[index]
	var a := Vector2(capsule[0],capsule[1])-anchor
	var b := Vector2(capsule[2],capsule[3])-anchor
	var geometry := shape.shape as CapsuleShape2D
	geometry.radius = float(capsule[4])
	geometry.height = a.distance_to(b)+geometry.radius*2.0
	shape.position = (a+b)/2.0
	shape.rotation = (b-a).angle()-PI/2.0
	shape.disabled = false
	active = true
	queue_redraw()

func touches(target: Area2D) -> bool:
	if not active:
		return false
	for hurt: CollisionShape2D in target.shapes:
		if not hurt.disabled and shape.shape.collide(shape.global_transform,hurt.shape,hurt.global_transform):
			return true
	return false

func contact_point(target: Area2D) -> Vector2:
	for hurt: CollisionShape2D in target.shapes:
		if hurt.disabled:
			continue
		var contacts := shape.shape.collide_and_get_contacts(shape.global_transform,hurt.shape,hurt.global_transform)
		if contacts.size()>=2:
			return (contacts[0]+contacts[1])*0.5
	return shape.global_position

func _draw() -> void:
	if not active or not debug_visible:
		return
	var a := Vector2(capsule[0],capsule[1])-anchor
	var b := Vector2(capsule[2],capsule[3])-anchor
	var radius := float(capsule[4])
	var angle := (b-a).angle()
	var points := PackedVector2Array()
	for i in range(13): points.append(b+Vector2.from_angle(angle-PI/2+i*PI/12)*radius)
	for i in range(13): points.append(a+Vector2.from_angle(angle+PI/2+i*PI/12)*radius)
	draw_colored_polygon(points,Color(1.0,0.12,0.2,0.3))
	points.append(points[0])
	draw_polyline(points,Color("ff4055"),2.0,true)
