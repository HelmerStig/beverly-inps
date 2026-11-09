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
			actor.locomotion_step(0,0,false,false,false,false,false,false,false,true)
			var foot_after: Dictionary=actor._planted_foot()
			check(((Vector2(foot_after.x,foot_after.y)-actor.anchor)*actor.sprite.scale).distance_to(sole_before)<.01,"Heavy kick starts without stance sliding")
			check(actor.attack_id=="heavy-kick" and actor.attack_active,"Heavy kick input starts standing move")
			check(actor.swing_player.playing and actor.swing_player.stream.resource_path=="res://assets/sounds/sfx/kick_long_whoosh_19.wav","Heavy kick uses original whoosh sound")
			actor.locomotion_step(0,.499999,false,false,false,false,false,false,false,true)
			check(not actor.hitbox.active,"Heavy kick startup has no offensive capsule")
			actor.locomotion_step(0,.000001,false,false,false,false,false,false,false,true)
			check(actor.hitbox.active and actor.frame_index==actor.animation.impactFrame,"Heavy kick impact at catalog 500ms")
			check(not actor.resolve_light_punch(target),"Distant heavy kick misses")
			actor.locomotion_step(0,.25,false,false,false,false,false,false,false,true)
			check(actor.attack_active,"Heavy kick keeps full recovery after 500ms")
			actor.locomotion_step(0,.25,false,false,false,false,false,false,false,true)
			check(not actor.attack_active and actor.animation_id=="idle","Heavy kick ends at catalog 1000ms")
			actor.locomotion_step(0,.25,false,false,false,false,false,false,false,true)
			check(not actor.attack_active,"Held heavy kick does not auto-repeat")
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			actor.start_heavy_kick()
			actor.locomotion_step(0,.5)
			scene._update_view()
			if index==3 and slot==0:
				scene.set_hurtboxes_visible(true)
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png("res://tests/artifacts/heavy-kick-mileto-contact.png")
			check(actor.resolve_light_punch(target),"Heavy kick reaches contact: "+str(actor.data.id)+" facing "+str(slot))
			check(target.animation_id==("hurt-medium" if actor.data.id=="arianna" else "hurt-high"),"Heavy kick starts high hurt: "+str(actor.data.id))
			check(actor.hit_player.playing and actor.hit_player.stream.resource_path=="res://assets/sounds/sfx/body_hit_large_76.wav","Heavy kick uses legacy impact sound")
			check(not actor.resolve_light_punch(target),"Heavy kick hits target once")
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			target.set_training_stance(true,true)
			actor.start_heavy_kick()
			actor.locomotion_step(0,.5)
			scene._update_view()
			check(target.receive_light_punch(actor) and target.animation_id=="block-low","Low guard blocks standing heavy kick: "+str(actor.data.id))
			var pose: int=target.frame_index
			target.locomotion_step(0,.1)
			check(target.frame_index==pose,"Medium guard holds through kick")
			actor.locomotion_step(0,.5)
			target.locomotion_step(0,.5)
			target.locomotion_step(0,.5)
			check(target.animation_id=="crouch","Dummy returns to held crouch")
			target.set_training_stance(true,false)
			actor.start_heavy_kick()
			check(target.receive_light_punch(actor) and target.animation_id==("block-mid" if actor.data.id=="arianna" else "block-high"),"Standing guard enters medium block")
			scene.reset_positions()
			actor.start_heavy_kick()
			var clock:=0.0
			for frame in range(actor.animation.frames.size()):
				if actor.animation.frameDurations[frame]==0: continue
				actor.elapsed=clock+.000001
				actor._update_frame()
				check(actor.frame_index==frame and actor.hurtboxes.current_frame==frame,"Every medium pose has matching geometry")
				var cell: Array=actor.animation.frames[frame]
				check(actor.sprite.region_rect==Rect2(cell[0],cell[1],cell[2],cell[3]),"Atlas frame order preserved")
				clock+=float(actor.animation.frameDurations[frame])/1000.0
			check(absf(clock-1.0)<.00001,"Full catalog duration")
			if actor.data.id=="bue":
				check(actor.animation.frames.size()==50,"Bue includes full 49-frame recovery sheet")
				check(int(actor.animation.frames[48][0])==3072 and int(actor.animation.frames[48][1])==3072,"Bue reaches final grounded pose before idle")
				check(absf(actor.animation.frameDurations[22]-13.227513)<.0001,"Bue recovery advances smoothly after active frames")
			if actor.data.id=="mangler":check(actor.animation.frames.size()==56 and actor.animation.sourceFrames.size()==55,"Mangler retains source frame 21..48 then 47..21")
			scene.reset_positions()
			actor.locomotion_step(0,.1,true)
			actor.locomotion_step(0,.01,false,false,false,false,false,false,false,true)
			check(not actor.attack_active and actor.jump.active,"No standing heavy kick while jumping")
			scene.reset_positions()
			actor.locomotion_step(0,.1,false,false,true)
			actor.locomotion_step(0,.01,false,false,true,false,false,false,false,true)
			check(not actor.attack_active and actor.crouch.is_active(),"No standing heavy kick while crouching")
			scene.reset_positions()
			actor.start_heavy_kick()
			actor.locomotion_step(0,.5)
			scene._update_view()
			var probe=load("res://scenes/debug/hurtbox_rig.gd").new()
			root.add_child(probe)
			var circle:=CollisionShape2D.new()
			circle.shape=CircleShape2D.new()
			circle.shape.radius=2
			probe.add_child(circle)
			probe.shapes.append(circle)
			var foot: Vector2=actor.hitbox.shape.global_position
			var inward: Vector2=actor.hitbox.global_transform*Vector2(0,actor.hitbox.shape.position.y)
			circle.global_position=inward.lerp(foot,.45)
			check(not actor.hitbox.touches(probe),"Foot has passed close target")
			check(actor.hitbox.touches(probe,true),"Inward sweep catches close target in both facings")
			check(actor.hitbox.contact_point(probe,true).distance_to(circle.global_position)<30,"Sweep contact effect stays on victim")
			circle.global_position=foot+(foot-inward).normalized()*100
			check(not actor.hitbox.touches(probe,true),"Sweep never extends maximum reach")
			circle.global_position=inward.lerp(foot,.45)+Vector2(0,150)
			check(not actor.hitbox.touches(probe,true),"Sweep preserves vertical misses")
			actor.locomotion_step(0,.5)
			circle.global_position=inward.lerp(foot,.45)
			check(not actor.hitbox.touches(probe,true),"Sweep disabled after active attack")
			probe.queue_free()

	for slot in range(2):
		scene.reset_positions()
		var event:=InputEventKey.new()
		event.physical_keycode=KEY_H if slot==0 else KEY_COMMA
		event.pressed=true
		Input.parse_input_event(event)
		Input.flush_buffered_events()
		scene.movement_enabled=true
		for tick in range(6):await physics_frame
		check(scene.fighters[slot].attack_active and scene.fighters[slot].attack_id=="heavy-kick","Physical heavy kick key starts move")
		event=event.duplicate()
		event.pressed=false
		Input.parse_input_event(event)
		Input.flush_buffered_events()
		scene.movement_enabled=false
	print("Heavy kick checks: ",failures," failures")
	quit(1 if failures else 0)
