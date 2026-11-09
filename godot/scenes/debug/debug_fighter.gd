extends Node2D
signal light_punch_landed(target: Node2D)
signal light_punch_contact(point: Vector2, blocked: bool, direction: float)
## Catalog-driven locomotion with pose-specific hurt geometry.
const SHADER := preload("res://shaders/debug_fighter.gdshader")
const HURTBOX_RIG := preload("res://scenes/debug/hurtbox_rig.gd")
const LOCOMOTION := preload("res://scenes/debug/locomotion.gd")
const JUMP_MOTION := preload("res://scenes/debug/jump_motion.gd")
const CROUCH_MOTION := preload("res://scenes/debug/crouch_motion.gd")
const HITBOX := preload("res://scenes/debug/light_punch_hitbox.gd")
const SWING_SOUND := preload("res://assets/sounds/sfx/swosh.wav")
const HEAVY_HIT_SOUND := preload("res://assets/sounds/sfx/strong-punch.wav")
const HIT_SOUND := preload("res://assets/sounds/sfx/light-punch.wav")
const BLOCK_SOUND := preload("res://assets/sounds/sfx/block_small_69.wav")
const JUMP_POSES := {
	"arianna": {"hold":27,"descent":28,"touchdown":38,"end":48},
	"bue": {"hold":20,"descent":20,"touchdown":26,"end":36},
	"mangler": {"hold":14,"descent":14,"touchdown":0,"end":0},
	"mileto": {"hold":24,"descent":24,"touchdown":32,"end":38},
	"oscare": {"hold":20,"descent":20,"touchdown":30,"end":37},
	"torpe": {"hold":17,"descent":17,"touchdown":24,"end":33},
}
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
var jump := JUMP_MOTION.new()
var crouch := CROUCH_MOTION.new()
var body_y := 0.0
var jump_was_down := false
var jump_sequence_end := 0.0
var landing_active := false
var landing_elapsed := 0.0
var touchdown_hold := false
var hitbox: Area2D
var swing_player: AudioStreamPlayer
var hit_player: AudioStreamPlayer
var attack_id := "light-punch"
var medium_was_down := false
var heavy_was_down := false
var attack_active := false
var attack_elapsed := 0.0
var attack_was_down := false
var attack_targets: Dictionary = {}
var confirmed_hits := 0
var guard_held := false
var training_guard := false
var training_crouch := false
var hurt_plant_locked := false
var hurt_plant_reference := Vector2.ZERO
var reaction_kind := ""
var reaction_attacker: Node2D
var guard_recovering := false
var block_player: AudioStreamPlayer

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	shadow_sprite = _make_sprite(true)
	sprite = _make_sprite(false)
	hurtboxes = HURTBOX_RIG.new()
	hurtboxes.name = "Hurtboxes"
	add_child(hurtboxes)
	hitbox = HITBOX.new()
	hitbox.name = "LightPunchHitbox"
	add_child(hitbox)
	swing_player = AudioStreamPlayer.new()
	swing_player.stream = SWING_SOUND
	add_child(swing_player)
	hit_player = AudioStreamPlayer.new()
	hit_player.stream = HEAVY_HIT_SOUND if attack_id=="heavy-punch" else HIT_SOUND
	add_child(hit_player)
	block_player = AudioStreamPlayer.new()
	block_player.stream = BLOCK_SOUND
	add_child(block_player)

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
	crouch.reset()
	training_guard = false
	training_crouch = false
	_clear_reaction()
	_cancel_attack()
	data = character
	motion.reset()
	jump.reset()
	body_y = 0.0
	jump_was_down = false
	landing_active = false
	touchdown_hold = false
	if movement_contacts.is_empty():
		movement_contacts = JSON.parse_string(FileAccess.get_file_as_string("res://data/movement-contacts.json"))
	elapsed = 0.0
	var idle: Dictionary = data.idle
	anchor = Vector2(idle.normalizedPreview.anchor[0], idle.normalizedPreview.anchor[1])
	stage_scale = float(idle.normalizedPreview.scale[0]) * (float(data.heightCm) / 165.0) * float(data.get("heightScaleCorrection",1.0)) * (4.0 / 3.0)
	hurtboxes.select_character(character,anchor)
	set_animation("idle",true)

func set_animation(id: String, force: bool = false) -> void:
	if animation_id==id and not force:
		return
	animation_id = id
	if id not in ["hurt-high","hurt-medium"]:
		hurt_plant_locked = false
	animation = data.animations[id]
	elapsed = 0.0
	anchor = Vector2(animation.normalizedPreview.anchor[0],animation.normalizedPreview.anchor[1])
	visual_scale = float(animation.normalizedPreview.scale[0]) * (float(data.heightCm)/165.0) * float(data.get("heightScaleCorrection",1.0)) * (4.0/3.0)
	if id in ["medium-punch","heavy-punch"]:
		# The catalog centers each move's union bounds, which include the extended
		# arm. Align its initial stance with idle instead of shifting the body back.
		var idle: Dictionary = data.animations.idle
		var idle_anchor := Vector2(idle.normalizedPreview.anchor[0],idle.normalizedPreview.anchor[1])
		var idle_foot := _animation_planted_foot("idle",0)
		var attack_foot := _animation_planted_foot(id,0)
		anchor = Vector2(attack_foot.x,attack_foot.y)-(Vector2(idle_foot.x,idle_foot.y)-idle_anchor)*stage_scale/visual_scale
	hurtboxes.select_animation(data,id,anchor)
	var texture := load("res://" + str(animation.image)) as Texture2D
	sprite.texture = texture
	shadow_sprite.texture = texture
	sprite.offset = -anchor
	shadow_sprite.offset = -anchor
	if id=="jump":
		jump_sequence_end = animation_duration("jump")
	if id in ["light-punch","medium-punch","heavy-punch"]:
		hitbox.configure(data,anchor,id)
	_update_frame()

func _cancel_attack() -> void:
	attack_active = false
	attack_elapsed = 0.0
	attack_was_down = false
	medium_was_down = false
	heavy_was_down = false
	attack_targets.clear()
	if hitbox!=null:
		hitbox.disable()
	if swing_player!=null:
		swing_player.stop()
	if hit_player!=null:
		hit_player.stop()

func start_light_punch() -> void:
	start_attack("light-punch")

func start_medium_punch() -> void:
	start_attack("medium-punch")

func start_heavy_punch() -> void:
	start_attack("heavy-punch")

func start_attack(id: String) -> void:
	attack_id = id
	attack_active = true
	attack_elapsed = 0.0
	attack_targets.clear()
	landing_active = false
	touchdown_hold = false
	motion.reset()
	set_animation(attack_id,true)
	hit_player.stream = HEAVY_HIT_SOUND if attack_id=="heavy-punch" else HIT_SOUND
	swing_player.play()

func resolve_light_punch(target: Node2D) -> bool:
	if not attack_active or attack_targets.has(target.get_instance_id()) or not hitbox.touches(target.hurtboxes):
		return false
	attack_targets[target.get_instance_id()] = true
	var point: Vector2 = hitbox.contact_point(target.hurtboxes)
	var blocked: bool = target.receive_light_punch(self)
	light_punch_contact.emit(point,blocked,-1.0 if flipped else 1.0)
	if blocked:
		target.block_player.play()
		return true
	confirmed_hits += 1
	hit_player.play()
	light_punch_landed.emit(target)
	return true

func _clear_reaction() -> void:
	reaction_kind = ""
	reaction_attacker = null
	guard_recovering = false
	guard_held = false
	if block_player!=null:
		block_player.stop()

func receive_light_punch(attacker: Node2D) -> bool:
	var facing := -1.0 if flipped else 1.0
	var crouched := training_crouch or crouch.is_active()
	var blocked: bool = guard_held and not attack_active and not jump.active and body_y==0.0 and (attacker.world_x-world_x)*facing>0.0
	if data.id=="mangler" and not blocked and not jump.active and body_y==0.0:
		var foot := _planted_foot()
		hurt_plant_reference = (Vector2(foot.x,foot.y)-anchor)*visual_scale
		hurt_plant_locked = true
	_cancel_attack()
	crouch.reset()
	motion.reset()
	landing_active = false
	touchdown_hold = false
	reaction_kind = ("block-low" if crouched else "block-high") if blocked else ("hurt-medium" if attacker.attack_id in ["medium-punch","heavy-punch"] else "hurt-high")
	reaction_attacker = attacker if blocked else null
	guard_recovering = false
	set_animation(reaction_kind,true)
	if blocked:
		# The demo stores a forward sequence followed by its reverse. Enter the
		# actual defensive pose immediately, then hold it for the incoming move.
		elapsed = _reaction_frame_time(int(animation.sourceForwardFrameCount)-1)
		_update_frame()
	return blocked

func _reaction_frame_time(index: int) -> float:
	var time := 0.000001
	for frame in range(index):
		time += float(animation.frameDurations[frame])/1000.0
	return time

func _reaction_step(delta: float) -> float:
	var displacement := 0.0
	# A hit in flight must not suspend the vertical physics.
	if jump.active:
		displacement = jump.step(delta)
		body_y = jump.body_y
	if reaction_kind in ["block-high","block-low"] and not guard_recovering:
		if is_instance_valid(reaction_attacker) and reaction_attacker.attack_active:
			return displacement
		guard_recovering = true
		elapsed = _reaction_frame_time(int(animation.sourceForwardFrameCount))
	else:
		elapsed += delta
	if elapsed>=animation_duration(reaction_kind)-0.0000001:
		_clear_reaction()
		if training_guard or training_crouch:
			_apply_training_pose()
		else:
			set_animation("idle",true)
	else:
		_update_frame()
	return displacement

func set_training_stance(guard: bool, crouched: bool) -> void:
	reset_motion()
	training_guard = guard
	training_crouch = crouched
	guard_held = guard
	_apply_training_pose()

func _apply_training_pose() -> void:
	guard_held = training_guard
	var id := "block-low" if training_guard and training_crouch else "block-high" if training_guard else "crouch" if training_crouch else "idle"
	set_animation(id)
	if id!="idle":
		var pose: int = int(animation.sourceForwardFrameCount)-1 if training_guard else animation.frames.size()-1
		elapsed = _reaction_frame_time(pose)
		_update_frame()

func animation_duration(id: String) -> float:
	var a: Dictionary = data.animations[id]
	if a.has("frameDurations"):
		var total := 0.0
		for duration: float in a.frameDurations:
			total += duration/1000.0
		return total
	return a.frames.size()/float(a.playbackFps)

func _jump_frame_time(index: int) -> float:
	var time := 0.0
	for frame in range(index):
		time += float(data.animations.jump.frameDurations[frame])/1000.0
	return time+0.000001

func _character_jump_clock() -> float:
	if jump.elapsed<jump.startup:
		return jump.elapsed
	var pose: Dictionary = JUMP_POSES[data.id]
	var airborne := jump.elapsed-jump.startup
	if airborne<=jump.ascent_duration:
		var progress := clampf(airborne/(jump.ascent_duration*0.65),0.0,1.0)
		var takeoff := int(data.animations.jump.takeoffFrame)
		return _jump_frame_time(takeoff+int(floor(progress*(int(pose.hold)-takeoff))))
	var progress := clampf((airborne-jump.ascent_duration)/jump.fall_duration,0.0,1.0)
	var difference := int(pose.touchdown)-int(pose.descent)
	return _jump_frame_time(int(pose.descent)+int(signf(difference))*int(floor(progress*abs(difference)+0.0000001)))

func locomotion_step(axis: float, delta: float, jump_down: bool = false, attack_down: bool = false, crouch_down: bool = false, medium_down: bool = false, heavy_down: bool = false) -> float:
	var jump_pressed := jump_down and not jump_was_down
	var attack_pressed := attack_down and not attack_was_down
	var medium_pressed := medium_down and not medium_was_down
	var heavy_pressed := heavy_down and not heavy_was_down
	heavy_was_down = heavy_down
	medium_was_down = medium_down
	attack_was_down = attack_down
	jump_was_down = jump_down
	guard_held = training_guard or axis*(-1.0 if flipped else 1.0)<-0.2
	if not reaction_kind.is_empty():
		return _reaction_step(delta)
	if training_guard or training_crouch:
		_apply_training_pose()
		return 0.0
	touchdown_hold = false
	if (attack_pressed or medium_pressed or heavy_pressed) and not attack_active and not jump.active and not crouch.is_active() and not crouch_down and body_y==0.0 and motion.state!="back-jump" and not jump_pressed:
		start_attack("heavy-punch" if heavy_pressed else "medium-punch" if medium_pressed else "light-punch")
	if attack_active:
		attack_elapsed = minf(attack_elapsed+delta,animation_duration(attack_id))
		elapsed = attack_elapsed
		_update_frame()
		if attack_elapsed>=animation_duration(attack_id)-0.0000001:
			attack_active = false
			hitbox.disable()
			motion.reset()
			set_animation("idle")
		return 0.0
	if crouch.is_active() or (crouch_down and not jump.active and body_y==0.0 and motion.state!="back-jump"):
		if not crouch.is_active():
			motion.reset()
			landing_active = false
			touchdown_hold = false
			set_animation("crouch",true)
		crouch.step(crouch_down,delta,animation_duration("crouch"))
		if crouch.is_active():
			elapsed = crouch.clock
			_update_frame()
			return 0.0
		delta = crouch.unused_delta
		set_animation("idle",true)
	if jump_pressed and not jump.active and motion.state!="back-jump":
		landing_active = false
		var forward := axis*(-1.0 if flipped else 1.0)>0.0
		jump.begin(data.id,axis,motion.state=="run",animation_duration("jump"),float(data.animations.jump.takeoffMs)/1000.0,forward)
		motion.reset()
		set_animation("jump")
	if jump.active:
		var displacement := jump.step(delta)
		body_y = jump.body_y
		# The sprite runs on its own source clock. Never stretch the final airborne
		# poses to fill the physics trajectory or hold their last frame in mid-air.
		if animation_id=="jump" and JUMP_POSES.has(data.id):
			elapsed = _character_jump_clock()
		elif animation_id=="jump":
			# Preserve visible anticipation. Speed up a long airborne sequence to
			# fit the flight, but never slow down a shorter one into a final hold.
			var air_length := maxf(0.000001,jump_sequence_end-jump.startup)
			var air_speed := maxf(1.0,air_length/jump.flight_duration)
			var clip_time := jump.elapsed if jump.elapsed<=jump.startup else jump.startup+(jump.elapsed-jump.startup)*air_speed
			if clip_time>=jump_sequence_end-0.0000001:
				var remaining := maxf(0.0,(clip_time-jump_sequence_end)/air_speed)
				set_animation("idle")
				elapsed = remaining
			else:
				elapsed = clip_time
		else:
			elapsed += delta
		_update_frame()
		if not jump.active:
			motion.reset()
			# Consume any grounded part of this same physics tick immediately.
			displacement += motion.step(axis,flipped,jump.unused_delta,animation_duration("back-jump"))
			if JUMP_POSES.has(data.id):
				var pose: Dictionary = JUMP_POSES[data.id]
				landing_active = int(pose.end)>int(pose.touchdown)
				touchdown_hold = not landing_active
				landing_elapsed = 0.0
				elapsed = _jump_frame_time(int(pose.touchdown))
				_update_frame()
			else:
				set_animation(motion.state)
		return displacement
	var distance := motion.step(axis,flipped,delta,animation_duration("back-jump"))
	if landing_active:
		landing_elapsed += delta
		var pose: Dictionary = JUMP_POSES[data.id]
		var duration := (int(pose.end)-int(pose.touchdown)+1)/100.0
		if landing_elapsed<duration-0.0000001 and motion.state!="back-jump":
			elapsed = _jump_frame_time(mini(int(pose.end),int(pose.touchdown)+int(floor(landing_elapsed*100.0+0.0000001))))
			_update_frame()
			return distance
		landing_active = false
	set_animation(motion.state)
	return distance

func reset_motion() -> void:
	crouch.reset()
	training_guard = false
	training_crouch = false
	_clear_reaction()
	_cancel_attack()
	motion.reset()
	jump.reset()
	body_y = 0.0
	jump_was_down = false
	landing_active = false
	landing_elapsed = 0.0
	touchdown_hold = false
	set_animation("idle",true)

func _feet() -> Array:
	var feet: Array = movement_contacts[data.id][animation_id][frame_index]
	return feet if not feet.is_empty() else [{"x":anchor.x,"y":anchor.y,"width":36.0}]

func _planted_foot() -> Dictionary:
	return _animation_planted_foot(animation_id,frame_index)

func _animation_planted_foot(id: String, index: int) -> Dictionary:
	var feet: Array = movement_contacts[data.id][id][index]
	if feet.is_empty():
		return {"x":anchor.x,"y":anchor.y}
	var lowest: Dictionary = feet[0]
	for foot: Dictionary in feet:
		if float(foot.y)>float(lowest.y):
			lowest = foot
	return lowest

func _process(delta: float) -> void:
	if not frozen and not jump.active and not crouch.is_active() and not landing_active and not touchdown_hold and not attack_active and reaction_kind.is_empty() and not training_guard and not training_crouch:
		elapsed += delta
	if not data.is_empty():
		_update_frame()

func _update_frame() -> void:
	var duration := animation_duration(animation_id)
	var clock := minf(elapsed,duration-0.000001) if animation_id in ["back-jump","jump","light-punch","hurt-high","block-high","crouch","block-low","medium-punch","hurt-medium","heavy-punch"] else fposmod(elapsed,duration)
	frame_index = 0
	if animation.has("frameDurations"):
		while frame_index<animation.frames.size()-1 and clock>=float(animation.frameDurations[frame_index])/1000.0-0.0000001:
			clock -= float(animation.frameDurations[frame_index])/1000.0
			frame_index += 1
	else:
		frame_index = mini(int(floor(clock*float(animation.playbackFps)+0.0000001)),animation.frames.size()-1)
	var cell: Array = animation.frames[frame_index]
	if hurt_plant_locked and animation_id in ["hurt-high","hurt-medium"]:
		# Legacy Mangler hurt frames lean far outside their initial stance. The
		# union-bounds center is not a stable pivot: keep the planted sole fixed.
		var foot := _planted_foot()
		anchor = Vector2(foot.x,foot.y)-hurt_plant_reference/visual_scale
		sprite.offset = -anchor
		shadow_sprite.offset = -anchor
		hurtboxes.anchor = anchor
	var region := Rect2(cell[0], cell[1], cell[2], cell[3])
	sprite.region_rect = region
	shadow_sprite.region_rect = region
	var flip := -1.0 if flipped else 1.0
	sprite.scale = Vector2(visual_scale * flip, visual_scale)
	if animation_id in ["light-punch","medium-punch","heavy-punch"]:
		hitbox.update_frame(frame_index,attack_active,sprite.scale)
	else:
		hitbox.disable()
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
	var attached := animation_id in ["idle","walk","backwalk","light-punch","hurt-high","block-high","crouch","block-low"]
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
	shadow_sprite.position.y -= body_y
	shadow_sprite.modulate.a = clampf(1.0-(maxf(0.0,anchor.y-bottom)*visual_scale-body_y)/600.0,0.35,1.0)
	shadow_sprite.visible = effects_enabled
	(sprite.material as ShaderMaterial).set_shader_parameter("effects_enabled", effects_enabled)
	queue_redraw()

func _draw() -> void:
	if data.is_empty() or not effects_enabled:
		return
	if body_y < -1.0:
		return
	var flip := -1.0 if flipped else 1.0
	var feet := _feet()
	var bottom := -INF
	for foot: Dictionary in feet:
		bottom = maxf(bottom,float(foot.y))
	for foot: Dictionary in feet:
		var attached := animation_id in ["idle","walk","backwalk","light-punch","hurt-high","block-high","crouch","block-low"]
		if not attached and (bottom<anchor.y-12.0 or float(foot.y)<bottom-6.0):
			continue
		var x := flip * visual_scale * (float(foot.x) - anchor.x)
		var y := visual_scale * (float(foot.y)-anchor.y) if attached else 0.0
		var width := clampf(float(foot.width) * visual_scale, 24.0, 100.0)
		for index in range(3):
			var ratio := 1.0 if index == 1 else 0.75
			draw_rect(Rect2(x - width * ratio / 2.0, y - 2 + index * 2, width * ratio, 2), Color(29.0/255,22.0/255,37.0/255,0.224))
