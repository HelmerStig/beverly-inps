extends SceneTree
const CAMERA := preload("res://scenes/debug/debug_camera.gd")
var failures := 0

func _initialize() -> void:
	call_deferred("_run")

func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _run() -> void:
	var scene: PackedScene = load("res://scenes/debug/debug_screen.tscn")
	if scene == null or not scene.can_instantiate():
		quit(1)
		return
	var debug := scene.instantiate()
	root.add_child(debug)
	current_scene = debug
	debug.movement_enabled = false
	await process_frame
	check(debug.fighters.size()==2 and debug.roster.size()==7,"Two slots and seven characters")
	check(debug.camera_x==315.0,"Stage starts centered")
	check(not debug.hurtboxes_visible,"Hurtboxes start hidden")
	var f3 := InputEventKey.new()
	f3.keycode = KEY_F3
	f3.pressed = true
	root.push_input(f3)
	check(debug.hurtboxes_visible,"F3 shows hurtboxes")
	for slot in range(2):
		for index in range(7):
			debug.select_character(slot,index)
			var fighter: Node2D = debug.fighters[slot]
			check(fighter.sprite.texture != null,"Idle sheet loads")
			check(fighter.data.idle.playbackFps==24,"Demo idle FPS retained")
			check(fighter.data.footContacts.size()==fighter.data.idle.frames.size(),"Foot contacts match the selected idle")
			fighter.elapsed = 0.0
			fighter._update_frame()
			check(fighter.frame_index==0,"Idle begins at frame zero")
			fighter.elapsed = 1.0/24.0
			fighter._update_frame()
			check(fighter.frame_index==1,"Idle advances at 24 FPS")
			check(fighter.hurtboxes.shapes.size()==13,"All anatomical hurt capsules exist")
			check(fighter.hurtboxes.monitorable and fighter.hurtboxes.collision_layer==2,"Hurtboxes are real target areas")
			check(fighter.hurtboxes.debug_visible,"Changing character retains F3 visibility")
			check(is_equal_approx(fighter.hurtboxes.scale.x,(-1.0 if fighter.flipped else 1.0)*fighter.stage_scale),"Hurtbox scale mirrors the visible fighter")
			for frame in range(fighter.data.idle.frames.size()):
				fighter.hurtboxes.update_frame(frame)
				for shape: CollisionShape2D in fighter.hurtboxes.shapes:
					check(not shape.disabled and shape.shape.radius>0 and shape.shape.height>=shape.shape.radius*2,"Valid active capsule in every idle frame")
	root.push_input(f3)
	check(not debug.hurtboxes_visible,"Second F3 hides overlay")
	check(not debug.fighters[0].hurtboxes.shapes[0].disabled,"F3 does not disable hurt collision geometry")
	await physics_frame
	await physics_frame
	var target: Area2D = debug.fighters[0].hurtboxes
	var query := PhysicsPointQueryParameters2D.new()
	query.position = target.shapes[0].global_position
	query.collide_with_areas = true
	query.collide_with_bodies = false
	query.collision_mask = 2
	var hits := target.get_world_2d().direct_space_state.intersect_point(query)
	check(hits.any(func(hit: Dictionary): return hit.collider==target),"Hidden hurtbox is queryable by the physics engine")
	debug.reset_positions()
	for fighter in debug.fighters:
		fighter.frozen = true
		fighter._update_frame()
	debug.move_pair(Vector2(10000,0))
	var stopped: float = debug.fighters[0].world_x
	check(stopped<debug.fighters[1].world_x,"P1 cannot tunnel through a stationary opponent")
	check(debug.fighters[1].world_x==1890.0,"Contact does not push the stationary opponent")
	debug.move_pair(Vector2(100,0))
	check(is_equal_approx(debug.fighters[0].world_x,stopped),"Advancing remains blocked at contact")
	for first: CollisionShape2D in debug.fighters[0].hurtboxes.shapes:
		for second: CollisionShape2D in debug.fighters[1].hurtboxes.shapes:
			check(not first.shape.collide(first.global_transform,second.shape,second.global_transform),"Actual capsule shapes do not interpenetrate at contact")
	debug.move_pair(Vector2(-50,0))
	check(debug.fighters[0].world_x<stopped,"Retreat remains possible at contact")
	debug.reset_positions()
	debug.move_pair(Vector2(10000,-10000))
	check(debug.fighters[0].world_x<debug.fighters[1].world_x,"Simultaneous inward movement cannot swap sides")
	var contact_gap: float = debug.fighters[1].world_x-debug.fighters[0].world_x
	check(is_equal_approx(contact_gap,debug.contact.separation(debug.fighters[0],debug.fighters[1])),"Both fighters stop at capsule contact")
	for fighter in debug.fighters:
		fighter.frozen = false
	debug.reset_positions()
	debug.move_pair(Vector2(-10000,0))
	check(debug.fighters[1].world_x==1890.0,"Stationary opponent is not dragged")
	check(is_equal_approx(debug.fighters[1].world_x-debug.fighters[0].world_x,CAMERA.MAX_SEPARATION),"Opponent blocks further separation")
	check(debug.camera_x>0,"Opposite fighter prevents camera reaching the left stage end")
	debug.move_pair(Vector2(-10000,-10000))
	check(debug.camera_x==0.0,"Both fighters can reach left stage end")
	debug.move_pair(Vector2(10000,10000))
	check(debug.camera_x==630.0,"Camera stops at right stage end")
	debug.reset_positions()
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	for iteration in range(300):
		debug.move_pair(Vector2(rng.randf_range(-150,150),rng.randf_range(-150,150)))
		var x1: float = debug.fighters[0].world_x
		var x2: float = debug.fighters[1].world_x
		check(absf(x1-x2)<=CAMERA.MAX_SEPARATION+0.001,"Separation remains inside camera width")
		check(debug.camera_x>=0 and debug.camera_x<=630,"Camera remains inside world")
		check(minf(x1,x2)-debug.camera_x>=CAMERA.MARGIN-0.001 or debug.camera_x==0,"Left fighter remains visible")
		check(maxf(x1,x2)-debug.camera_x<=1920-CAMERA.MARGIN+0.001 or debug.camera_x==630,"Right fighter remains visible")
	debug.select_character(0,0)
	debug.select_character(1,4)
	debug.reset_positions()
	var key := InputEventKey.new()
	key.physical_keycode = KEY_D
	key.pressed = true
	Input.parse_input_event(key)
	Input.flush_buffered_events()
	debug.movement_enabled = true
	await process_frame
	await physics_frame
	await physics_frame
	check(debug.fighters[0].world_x>675.0,"P1 keyboard movement reaches the stage")
	check(debug.fighters[1].world_x==1890.0,"P1 controls do not move P2")
	var released := key.duplicate() as InputEventKey
	released.pressed = false
	Input.parse_input_event(released)
	Input.flush_buffered_events()
	debug.movement_enabled = false
	debug.reset_positions()
	debug.background.frozen = true
	debug.background.elapsed = 0.0
	for fighter in debug.fighters:
		fighter.frozen = true
		fighter.elapsed = 0.0
	debug.pipeline.frozen = true
	debug.pipeline.clock = 0.0
	if DisplayServer.get_name()!="headless":
		await create_timer(0.4).timeout
		await RenderingServer.frame_post_draw
		DirAccess.make_dir_recursive_absolute("res://tests/artifacts")
		root.get_texture().get_image().save_png("res://tests/artifacts/debug-screen.png")
		root.push_input(f3)
		for frame in range(10):
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/debug-hurtboxes.png")
	# Verify the public title menu route, including confirmation sound completion.
	var back := InputEventJoypadButton.new()
	back.button_index = JOY_BUTTON_B
	back.pressed = true
	root.push_input(back)
	await process_frame
	check(current_scene==debug,"Joypad B is reserved and does not exit Debug")
	var arrow := InputEventKey.new()
	arrow.pressed = true
	arrow.keycode = KEY_RIGHT
	root.push_input(arrow)
	check(debug.selectors[0].selected==1 and debug.selectors[1].selected==4,"Horizontal arrows select P1 only")
	arrow.keycode = KEY_UP
	root.push_input(arrow)
	check(debug.selectors[0].selected==1 and debug.selectors[1].selected==3,"Vertical arrows select P2 only")
	var escape := InputEventKey.new()
	escape.pressed = true
	escape.keycode = KEY_ESCAPE
	root.push_input(escape)
	await process_frame
	await process_frame
	var title := current_scene
	check(title != null and title.name=="TitleScreen","Esc returns to title")
	if title != null:
		title._show_menu()
		title.menu_buttons[2].grab_focus()
		var accept := InputEventJoypadButton.new()
		accept.button_index = JOY_BUTTON_A
		accept.pressed = true
		root.push_input(accept)
		await process_frame
		accept.pressed = false
		root.push_input(accept)
		await create_timer(1.0).timeout
		check(current_scene != null and current_scene.name=="DebugScreen","Joypad A on focused Debug opens the stage")
	print("Debug screen checks: ",failures," failures")
	quit(1 if failures else 0)
