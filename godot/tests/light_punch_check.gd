extends SceneTree
var failures := 0

func _initialize() -> void:
	call_deferred("_run")

func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _run() -> void:
	var scene: Control = load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled = false
	await process_frame
	scene.set_hurtboxes_visible(true)
	for index in range(7):
		for slot in range(2):
			scene.select_character(slot,index)
			scene.select_character(1-slot,index)
			scene.reset_positions()
			for f in scene.fighters: f.frozen = true
			var attacker: Node2D = scene.fighters[slot]
			var target: Node2D = scene.fighters[1-slot]
			attacker.locomotion_step(0.0,0.0,false,true)
			check(attacker.attack_active and attacker.animation_id=="light-punch","Standing light punch starts")
			check(attacker.swing_player.playing,"Swing sound plays at attack start")
			check(not attacker.hitbox.active,"Startup has no attack hitbox")
			attacker.locomotion_step(0.0,0.29999,false,true)
			check(not attacker.hitbox.active,"Hitbox stays inactive before demo impact")
			attacker.locomotion_step(0.0,0.00001,false,true)
			check(attacker.frame_index==int(attacker.animation.impactFrame),"Impact frame occurs at 300ms")
			check(attacker.hitbox.active and not attacker.hitbox.shape.disabled,"Actual attack capsule is enabled at impact")
			check(not attacker.resolve_light_punch(target),"A distant punch misses")
			check(not attacker.hit_player.playing,"A miss does not play impact sound")
			attacker.locomotion_step(0.0,0.2,false,true)
			check(not attacker.attack_active and attacker.animation_id=="idle","Attack ends at 500ms")
			check(not attacker.hitbox.active,"No lingering attack hitbox")
			attacker.locomotion_step(0.0,0.1,false,true)
			check(not attacker.attack_active,"Holding punch does not repeat")
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			var count: int = attacker.confirmed_hits
			attacker.locomotion_step(0.0,0.0,false,true)
			attacker.locomotion_step(0.0,0.3,false,true)
			scene._update_view()
			check(attacker.hitbox.scale==attacker.sprite.scale,"Attack shape follows sprite scale and reflection")
			check(attacker.resolve_light_punch(target),"Punch reaches opponent from idle contact: "+str(attacker.data.id)+" slot "+str(slot))
			check(attacker.confirmed_hits==count+1,"A hit is counted once")
			check(attacker.hit_player.playing,"Impact sound plays on actual hit")
			check(not attacker.resolve_light_punch(target),"Same attack cannot hit the target again")
			check(target.animation_id=="idle","Hurt and guard reactions remain deferred")
			attacker.locomotion_step(0.0,0.2,false,true)
			attacker.locomotion_step(0.0,0.01,false,false)
			attacker.locomotion_step(0.0,0.0,false,true)
			check(attacker.attack_active,"A new press can start another attack after recovery")
			scene.reset_positions()
			attacker.locomotion_step(0.0,0.0,true,false)
			attacker.locomotion_step(0.0,0.2,false,true)
			check(not attacker.attack_active and attacker.jump.active,"Standing punch cannot start in the air")
	for slot in range(2):
		scene.select_character(0,0)
		scene.select_character(1,0)
		scene.reset_positions()
		scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
		var actor: Node2D = scene.fighters[slot]
		var before: int = actor.confirmed_hits
		var key := InputEventKey.new()
		key.physical_keycode = KEY_F if slot==0 else KEY_O
		key.pressed = true
		Input.parse_input_event(key)
		Input.flush_buffered_events()
		scene.movement_enabled = true
		await create_timer(0.12).timeout
		check(actor.attack_active,"Keyboard punch starts for player "+str(slot+1))
		await create_timer(0.3).timeout
		check(actor.confirmed_hits==before+1,"Physics update resolves one hit from actual keyboard input")
		var released := key.duplicate() as InputEventKey
		released.pressed = false
		Input.parse_input_event(released)
		Input.flush_buffered_events()
		scene.movement_enabled = false
	scene.select_character(0,0)
	scene.select_character(1,4)
	scene.reset_positions()
	scene.move_pair(Vector2(10000,0))
	scene.fighters[0].locomotion_step(0.0,0.0,false,true)
	scene.fighters[0].locomotion_step(0.0,0.3,false,true)
	scene._update_view()
	if DisplayServer.get_name()!="headless":
		await create_timer(0.3).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/light-punch-screen.png")
	print("Light punch checks: ",failures," failures")
	quit(1 if failures else 0)
