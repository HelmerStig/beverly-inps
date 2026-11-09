extends SceneTree
var failures := 0
func _initialize() -> void:
	call_deferred("run")
func check(value: bool,label: String) -> void:
	if not value:
		failures+=1
		push_error(label)
func run() -> void:
	var scene=load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled=false
	await process_frame
	for index in range(7):
		for slot in range(2):
			scene.select_character(0,index)
			scene.select_character(1,index)
			scene.reset_positions()
			for f in scene.fighters:f.frozen=true
			var actor: Node2D=scene.fighters[slot]
			var target: Node2D=scene.fighters[1-slot]
			var foot_before: Dictionary=actor._planted_foot()
			var sole_before: Vector2=(Vector2(foot_before.x,foot_before.y)-actor.anchor)*actor.sprite.scale
			actor.locomotion_step(0,0,false,false,false,false,false,false,true)
			var foot_after: Dictionary=actor._planted_foot()
			check(((Vector2(foot_after.x,foot_after.y)-actor.anchor)*actor.sprite.scale).distance_to(sole_before)<.01,"Medium kick starts without stance sliding")
			check(actor.attack_id=="medium-kick" and actor.attack_active,"Medium kick input starts standing move")
			check(actor.swing_player.playing and actor.swing_player.stream.resource_path=="res://assets/sounds/sfx/kick_short_whoosh_23.wav","Medium kick uses original whoosh sound")
			actor.locomotion_step(0,.449999,false,false,false,false,false,false,true)
			check(not actor.hitbox.active,"Medium kick startup has no offensive capsule")
			actor.locomotion_step(0,.000001,false,false,false,false,false,false,true)
			check(actor.hitbox.active and actor.frame_index==actor.animation.impactFrame,"Medium kick impact at catalog 450ms")
			check(not actor.resolve_light_punch(target),"Distant medium kick misses")
			actor.locomotion_step(0,.15,false,false,false,false,false,false,true)
			check(actor.attack_active,"Medium kick keeps full recovery after 450ms")
			actor.locomotion_step(0,.15,false,false,false,false,false,false,true)
			check(not actor.attack_active and actor.animation_id=="idle","Medium kick ends at catalog 750ms")
			actor.locomotion_step(0,.15,false,false,false,false,false,false,true)
			check(not actor.attack_active,"Held medium kick does not auto-repeat")
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			actor.start_medium_kick()
			actor.locomotion_step(0,.45)
			scene._update_view()
			if index==3 and slot==0:
				scene.set_hurtboxes_visible(true)
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png("res://tests/artifacts/medium-kick-mileto-contact.png")
			if actor.data.id=="peirolo":
				# Its extended idle arm creates a larger push distance than the kick reach.
				target.position.x += -100.0 if slot==0 else 100.0
			check(actor.resolve_light_punch(target),"Medium kick reaches contact: "+str(actor.data.id)+" facing "+str(slot))
			check(target.animation_id=="hurt-medium","Medium kick starts medium hurt: "+str(actor.data.id))
			check(actor.hit_player.playing and actor.hit_player.stream.resource_path=="res://assets/sounds/sfx/body_hit_large_44.wav","Medium kick uses legacy impact sound")
			check(not actor.resolve_light_punch(target),"Medium kick hits target once")
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			target.set_training_stance(true,true)
			actor.start_medium_kick()
			actor.locomotion_step(0,.45)
			scene._update_view()
			check(target.receive_light_punch(actor) and target.animation_id=="block-mid","Low guard blocks standing medium kick: "+str(actor.data.id))
			var pose: int=target.frame_index
			target.locomotion_step(0,.1)
			check(target.frame_index==pose,"Medium guard holds through kick")
			actor.locomotion_step(0,.5)
			target.locomotion_step(0,.45)
			target.locomotion_step(0,.5)
			check(target.animation_id=="crouch","Dummy returns to held crouch")
			target.set_training_stance(true,false)
			actor.start_medium_kick()
			check(target.receive_light_punch(actor) and target.animation_id=="block-mid","Standing guard enters medium block")
			scene.reset_positions()
			actor.start_medium_kick()
			var clock:=0.0
			for frame in range(actor.animation.frames.size()):
				if actor.animation.frameDurations[frame]==0: continue
				actor.elapsed=clock+.000001
				actor._update_frame()
				check(actor.frame_index==frame and actor.hurtboxes.current_frame==frame,"Every medium pose has matching geometry")
				var cell: Array=actor.animation.frames[frame]
				check(actor.sprite.region_rect==Rect2(cell[0],cell[1],cell[2],cell[3]),"Atlas frame order preserved")
				clock+=float(actor.animation.frameDurations[frame])/1000.0
			check(absf(clock-.75)<.00001,"Full catalog duration")
			if actor.data.id=="mangler":check(actor.animation.frames.size()==56 and actor.animation.sourceFrames.size()==55,"Mangler retains source frame 14..41 then 40..14")
			scene.reset_positions()
			actor.locomotion_step(0,.1,true)
			actor.locomotion_step(0,.01,false,false,false,false,false,false,true)
			check(not actor.attack_active and actor.jump.active,"No standing medium kick while jumping")
			scene.reset_positions()
			actor.locomotion_step(0,.1,false,false,true)
			actor.locomotion_step(0,.01,false,false,true,false,false,false,true)
			check(not actor.attack_active and actor.crouch.is_active(),"No standing medium kick while crouching")
	for slot in range(2):
		scene.reset_positions()
		var event:=InputEventKey.new()
		event.physical_keycode=KEY_B if slot==0 else KEY_N
		event.pressed=true
		Input.parse_input_event(event)
		Input.flush_buffered_events()
		scene.movement_enabled=true
		for tick in range(6):await physics_frame
		check(scene.fighters[slot].attack_active and scene.fighters[slot].attack_id=="medium-kick","Physical medium kick key starts move")
		event=event.duplicate()
		event.pressed=false
		Input.parse_input_event(event)
		Input.flush_buffered_events()
		scene.movement_enabled=false
	print("Medium kick checks: ",failures," failures")
	quit(1 if failures else 0)
