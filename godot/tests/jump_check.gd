extends SceneTree
const JUMP := preload("res://scenes/debug/jump_motion.gd")
const RECOVERY := {"arianna":[38,48],"bue":[26,36],"mileto":[32,38],"oscare":[30,37],"torpe":[24,33]}
const NEW_POSES := {"mileto":[24,32],"oscare":[20,30],"torpe":[17,24]}
var failures := 0

func _initialize() -> void:
	call_deferred("_run")

func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _run() -> void:
	var profiles: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/jump-profiles.json"))
	for id: String in profiles.characters:
		var p: Dictionary = profiles.characters[id]
		var scale := 1080.0/648.0
		var running_jump := JUMP.new()
		running_jump.begin(id,1.0,true,1.5)
		check(is_equal_approx(running_jump.horizontal_speed,float(p.airSpeed)*scale*float(profiles.horizontalDistanceMultiplier)*float(profiles.horizontalDistanceScale)*float(p.runMultiplier)),"Running-jump multiplier combines legacy profile and distance tuning")
		var backward := JUMP.new()
		backward.begin(id,-1.0,false,1.5,-1.0,false)
		var forward_jump := JUMP.new()
		forward_jump.begin(id,1.0,false,1.5)
		check(is_equal_approx(forward_jump.horizontal_speed,absf(backward.horizontal_speed)),"Forward and backward jumps have the same range")
		var landing := JUMP.new()
		landing.begin(id,0.0,false,10.0)
		landing.step(landing.startup+landing.flight_duration-0.0001)
		check(landing.active and landing.body_y<0,"Jump stays active until actual landing")
		landing.step(0.0001)
		check(not landing.active and landing.body_y==0,"Landing does not wait for animation recovery")
		for direction in [-1.0,0.0,1.0]:
			var jump := JUMP.new()
			jump.begin(id,direction,false,1.5)
			check(is_zero_approx(jump.step(jump.startup)),"No horizontal movement before takeoff")
			check(is_zero_approx(jump.body_y),"Startup stays grounded")
			jump.step(jump.ascent_duration)
			var expected_height := float(p.velocityY)*float(p.velocityY)/(2.0*float(p.gravity))*scale
			check(is_equal_approx(-jump.body_y,expected_height),"Apex height matches old velocity/gravity in new arena units")
			check(is_equal_approx(jump.fall_duration,jump.ascent_duration),"Original descent timing is restored")
			for fps in [30,60,120]:
				jump.begin(id,direction,false,1.5)
				var distance := 0.0
				for frame in range(fps*2):
					distance += jump.step(1.0/fps)
				check(not jump.active and jump.body_y==0.0,"Jump lands and recovery finishes")
				var expected_distance: float = direction*float(p.airSpeed)*scale*float(profiles.horizontalDistanceMultiplier)*float(profiles.horizontalDistanceScale)*(-float(p.velocityY)/float(p.gravity))*(1.0+float(profiles.horizontalFallSpeedScale)/float(profiles.descentSpeedMultiplier))
				check(is_equal_approx(distance,expected_distance),"Horizontal distance matches old air speed at any physics rate")
	var scene: Control = load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled = false
	await process_frame
	scene.set_hurtboxes_visible(true)
	for index in range(7):
		scene.select_character(0,index)
		var fighter: Node2D = scene.fighters[0]
		fighter.frozen = true
		fighter.locomotion_step(1.0,0.0,true)
		check(fighter.animation_id=="jump","Jump input starts jump animation")
		check(fighter.hurtboxes.animation_id=="jump","Jump uses its own hurtbox data")
		check(fighter.jump.total_duration<duration_for(fighter),"Physics landing ends before old animation tail")
		fighter.locomotion_step(-1.0,0.2,false)
		check(fighter.body_y<0.0,"Jump moves the Godot body into the air")
		check(fighter.jump.horizontal_speed>0.0,"Air direction remains locked after reversing input")
		var duration: float = fighter.animation_duration("jump")
		var startup_change: float = float(fighter.animation.takeoffMs)-float(fighter.animation.sourceTakeoffMs)
		check(is_equal_approx(duration,(float(fighter.animation.sourceDurationMs)+startup_change)/1000.0),"Jump keeps source timings with a visible startup")
		fighter.elapsed = float(fighter.animation.takeoffMs)/1000.0+0.00001
		fighter._update_frame()
		check(fighter.frame_index==int(fighter.animation.takeoffFrame),"Source takeoff frame matches 67ms startup")
		var clock := 0.0
		for frame in range(fighter.animation.frames.size()):
			fighter.elapsed = clock+0.00001
			fighter.body_y = -200.0
			fighter._update_frame()
			scene._update_view()
			check(fighter.frame_index==frame,"Exact jump sprite frame")
			check(fighter.hurtboxes.current_parts==fighter.hurtboxes.frame_data[frame],"Jump hurtboxes track exact pose")
			check(fighter.hurtboxes.scale==fighter.sprite.scale,"Air hurtboxes follow sprite scale")
			check(is_equal_approx(fighter.hurtboxes.global_position.y,825.0),"Hurtboxes follow physical body height")
			var bottom := -INF
			for foot: Dictionary in fighter._feet():
				bottom = maxf(bottom,float(foot.y))
			check(is_equal_approx(fighter.global_position.y+fighter.shadow_sprite.position.y,1025.0+0.11*fighter.visual_scale*(bottom-fighter.anchor.y)),"Shadow stays on its ground plane while body rises")
			clock += float(fighter.animation.frameDurations[frame])/1000.0
		fighter.reset_motion()
		check(fighter.body_y==0.0 and not fighter.jump.active,"Reset clears jump state")
		if fighter.data.id=="arianna":
			fighter.locomotion_step(0.0,0.0,true)
			fighter.locomotion_step(0.0,fighter.jump.startup+fighter.jump.ascent_duration*0.75,false)
			check(fighter.frame_index==27 and fighter.body_y<0.0,"Arianna holds visible frame 28 while airborne")
			fighter.locomotion_step(0.0,fighter.jump.ascent_duration*0.2,false)
			check(fighter.frame_index==27,"Arianna retains visible frame 28 until descent")
			fighter.locomotion_step(0.0,fighter.jump.ascent_duration*0.05+fighter.jump.fall_duration*0.5,false)
			check(fighter.frame_index>=28 and fighter.frame_index<38,"Arianna plays visible frames 29-38 during descent")
			fighter.locomotion_step(0.0,fighter.jump.fall_duration*0.5,false)
			check(fighter.frame_index==38 and fighter.body_y==0.0,"Arianna reaches visible frame 39 on touchdown")
			fighter.reset_motion()
		if fighter.data.id in ["bue","mangler"]:
			var is_bue: bool = fighter.data.id=="bue"
			var held_frame := 20 if is_bue else 14
			var ground_frame := 26 if is_bue else 0
			fighter.locomotion_step(0.0,0.0,true)
			fighter.locomotion_step(0.0,fighter.jump.startup+fighter.jump.ascent_duration*0.75,false)
			check(fighter.frame_index==held_frame and fighter.body_y<0.0,"Character-specific airborne hold: "+str(fighter.data.id))
			fighter.locomotion_step(0.0,fighter.jump.ascent_duration*0.25+fighter.jump.fall_duration*0.5,false)
			if is_bue:
				check(fighter.frame_index>=20 and fighter.frame_index<26,"Bue plays toward visible frame 27 on descent")
			else:
				check(fighter.frame_index<14 and fighter.frame_index>0,"Mangler reverses frames during descent")
			fighter.locomotion_step(0.0,fighter.jump.fall_duration*0.5,false)
			check(fighter.frame_index==ground_frame and fighter.body_y==0.0,"Character-specific touchdown frame: "+str(fighter.data.id))
			fighter.reset_motion()
		if NEW_POSES.has(fighter.data.id):
			var expected: Array = NEW_POSES[fighter.data.id]
			fighter.locomotion_step(0.0,0.0,true)
			fighter.locomotion_step(0.0,fighter.jump.startup+fighter.jump.ascent_duration*0.75,false)
			check(fighter.frame_index==int(expected[0]) and fighter.body_y<0.0,"Requested airborne hold pose: "+str(fighter.data.id))
			fighter.locomotion_step(0.0,fighter.jump.ascent_duration*0.2,false)
			check(fighter.frame_index==int(expected[0]),"Hold pose remains until descent")
			fighter.locomotion_step(0.0,fighter.jump.ascent_duration*0.05+fighter.jump.fall_duration*0.5,false)
			check(fighter.frame_index>=int(expected[0]) and fighter.frame_index<int(expected[1]),"Descent plays toward requested touchdown pose")
			fighter.locomotion_step(0.0,fighter.jump.fall_duration*0.5,false)
			check(fighter.frame_index==int(expected[1]) and fighter.body_y==0.0,"Requested ground contact pose: "+str(fighter.data.id))
			fighter.reset_motion()
		fighter.locomotion_step(0.0,0.0,true)
		var seen := {0:true}
		for tick in range(int(fighter.animation.takeoffFrame)-1):
			fighter.locomotion_step(0.0,1.0/60.0,true)
			seen[fighter.frame_index] = true
			check(fighter.body_y==0.0,"Visible anticipation stays grounded")
		check(seen.size()==int(fighter.animation.takeoffFrame),"All anticipation frames are visible at 60Hz")
		fighter.reset_motion()
		fighter.locomotion_step(0.0,0.0,true)
		var clip_end: float = fighter.jump_sequence_end
		check(is_equal_approx(clip_end,fighter.animation_duration("jump")),"No foot-based truncation of the jump animation")
		if clip_end<fighter.jump.total_duration-0.001:
			fighter.locomotion_step(0.0,clip_end+0.0001,false)
			check(fighter.animation_id=="idle","Finished airborne animation immediately becomes idle")
			check(fighter.jump.active and fighter.body_y<0,"Idle transition does not interrupt physical descent")
			var previous_y: float = fighter.body_y
			fighter.locomotion_step(0.0,0.01,false)
			check(fighter.body_y>previous_y,"Descent continues without a midair pause")
			check(fighter.hurtboxes.animation_id=="idle","Airborne idle uses matching hurtboxes")
		fighter.reset_motion()
		fighter.locomotion_step(0.0,0.0,true)
		var end: float = fighter.jump.total_duration
		fighter.locomotion_step(0.0,end-0.001,false)
		var landing_move: float = fighter.locomotion_step(1.0,0.011,false)
		check(not fighter.jump.active and fighter.body_y==0,"Fighter exits jump immediately on landing")
		if RECOVERY.has(fighter.data.id):
			var ground_frame: int = RECOVERY[fighter.data.id][0]
			var final_frame: int = RECOVERY[fighter.data.id][1]
			check(fighter.animation_id=="jump" and fighter.frame_index==ground_frame,"Correct touchdown pose before 100 FPS recovery")
			check(fighter.motion.state=="walk","Movement is available on touchdown")
			for frame in range(1,final_frame-ground_frame+1):
				var dx: float = fighter.locomotion_step(1.0,0.01,false)
				check(fighter.frame_index==ground_frame+frame,"Landing advances at 100 FPS")
				check(dx>0.0,"Landing animation does not lock movement")
			fighter.locomotion_step(1.0,0.01,false)
			check(fighter.animation_id=="walk","Locomotion animation resumes after recovery")
		elif fighter.data.id=="mangler":
			check(fighter.animation_id=="jump" and fighter.frame_index==0,"Mangler touches down on visible frame 1")
			fighter.locomotion_step(1.0,0.001,false)
			check(fighter.animation_id=="walk","Mangler touchdown does not lock locomotion")
		else:
			check(fighter.animation_id=="walk","Held direction resumes walking on landing tick")
		check(is_equal_approx(landing_move,420.0*0.01),"Remaining landing tick time is available to locomotion")
		fighter.reset_motion()
		fighter.locomotion_step(0.0,0.0,true)
		var played := {0:true}
		var frame_count: int = 15 if fighter.data.id=="mangler" else fighter.animation.frames.size()
		var hz := 120.0 if RECOVERY.has(fighter.data.id) else 60.0
		for tick in range(240):
			fighter.locomotion_step(0.0,1.0/hz,true)
			if fighter.animation_id=="jump":
				played[fighter.frame_index] = true
			if not fighter.jump.active and not fighter.landing_active:
				break
		check(played.size()==frame_count,"Full jump sequence is visible at 60Hz before landing: "+str(fighter.data.id))
		fighter.reset_motion()
		for frame in range(240):
			fighter.locomotion_step(0.0,1.0/120.0,true)
		check(not fighter.jump.active and fighter.body_y==0.0,"Holding jump does not automatically jump again")
	for index in range(7):
		scene.select_character(0,index)
		scene.select_character(1,4)
		scene.reset_positions()
		scene.move_pair(Vector2(10000,0))
		var opponent_x: float = scene.fighters[1].world_x
		var jumper: Node2D = scene.fighters[0]
		jumper.locomotion_step(1.0,0.0,true)
		for tick in range(240):
			var dx: float = jumper.locomotion_step(1.0,1.0/120.0,true)
			scene.move_pair(Vector2(dx,0.0))
			if not jumper.jump.active:
				break
		check(jumper.world_x>opponent_x,"Jump from contact can cross the opponent before landing: "+str(jumper.data.id))
		check(scene.fighters[1].world_x==opponent_x,"Jump does not drag the opponent")
	scene.select_character(0,0)
	scene.select_character(1,2)
	scene.reset_positions()
	var key := InputEventKey.new()
	key.physical_keycode = KEY_W
	key.pressed = true
	Input.parse_input_event(key)
	Input.flush_buffered_events()
	scene.movement_enabled = true
	await create_timer(0.2).timeout
	check(scene.fighters[0].jump.active and scene.fighters[0].body_y<0.0,"P1 W input initiates a physical jump")
	check(not scene.fighters[1].jump.active,"P1 jump input does not affect P2")
	var release := key.duplicate() as InputEventKey
	release.pressed = false
	Input.parse_input_event(release)
	Input.flush_buffered_events()
	scene.movement_enabled = false
	scene.reset_positions()
	for fighter in scene.fighters:
		fighter.frozen = true
		fighter.locomotion_step(0.0,0.0,true)
		fighter.locomotion_step(0.0,fighter.jump.startup+fighter.jump.ascent_duration,true)
	scene._update_view()
	if DisplayServer.get_name()!="headless":
		await create_timer(0.4).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/jump-screen.png")
	print("Jump checks: ",failures," failures")
	quit(1 if failures else 0)

func duration_for(fighter: Node2D) -> float:
	return fighter.animation_duration("jump")
