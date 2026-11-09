extends SceneTree
var failures:=0
func _initialize() -> void:call_deferred("run")
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
			var actor: Node2D=scene.fighters[slot]
			var target: Node2D=scene.fighters[1-slot]
			actor.locomotion_step(0,.5,false,false,true)
			var sole: Dictionary=actor._planted_foot()
			var before: Vector2=(Vector2(sole.x,sole.y)-actor.anchor)*actor.visual_scale
			actor.locomotion_step(0,0,false,true,true)
			check(actor.attack_id=="crouched-light-punch" and actor.attack_active,"Down plus light punch starts crouched move")
			sole=actor._planted_foot()
			check(((Vector2(sole.x,sole.y)-actor.anchor)*actor.visual_scale).distance_to(before)<.01,"Crouched attack preserves planted sole")
			actor.locomotion_step(0,.299999,false,true,true)
			check(not actor.hitbox.active,"Crouched punch startup inactive")
			actor.locomotion_step(0,.000001,false,true,true)
			check(actor.hitbox.active and actor.frame_index==actor.animation.impactFrame,"Crouched punch impact at 300ms")
			actor.locomotion_step(0,.2,false,true,true)
			check(not actor.attack_active and actor.animation_id=="crouch","Attack ends at 500ms and holds crouch")
			actor.locomotion_step(0,.1,false,true,true)
			check(not actor.attack_active,"Held punch does not repeat")
			actor.locomotion_step(0,.5,false,false,false)
			check(actor.animation_id=="idle","Release down returns to idle")
			for down in [false,true]:
				for guard in [false,true]:
					scene.reset_positions()
					target.set_training_stance(guard,down)
					actor.locomotion_step(0,0,false,true,true)
					check(target.receive_light_punch(actor)==guard,"Crouched punch guard classification")
					var expected: String=("block-low" if down else "block-mid") if guard else ("hurt-crouched" if down else "hurt-medium")
					check(target.animation_id==expected,"Correct crouched punch reaction "+expected)
					if guard:
						var pose: int=target.frame_index
						target.locomotion_step(0,.1)
						check(target.frame_index==pose,"Block holds to end of crouched attack")
			actor.start_attack("crouched-light-punch")
			var clock:=0.0
			for frame in range(actor.animation.frames.size()):
				if actor.animation.frameDurations[frame]==0:continue
				actor.elapsed=clock+.000001
				actor._update_frame()
				check(actor.frame_index==frame and actor.hurtboxes.current_frame==frame,"Every crouched punch frame has matching hurt geometry")
				clock+=float(actor.animation.frameDurations[frame])/1000.0
	for slot in range(2):
		scene.reset_positions()
		var down:=InputEventKey.new()
		down.physical_keycode=KEY_S if slot==0 else KEY_K
		down.pressed=true
		Input.parse_input_event(down)
		Input.flush_buffered_events()
		scene.movement_enabled=true
		for tick in range(20):await physics_frame
		var punch:=InputEventKey.new()
		punch.physical_keycode=KEY_F if slot==0 else KEY_O
		punch.pressed=true
		Input.parse_input_event(punch)
		Input.flush_buffered_events()
		for tick in range(6):await physics_frame
		check(scene.fighters[slot].attack_active and scene.fighters[slot].attack_id=="crouched-light-punch","Physical down and light punch keys trigger crouched attack")
		down.pressed=false
		punch.pressed=false
		Input.parse_input_event(down)
		Input.parse_input_event(punch)
		Input.flush_buffered_events()
		scene.movement_enabled=false
	print("Crouched light punch checks: ",failures," failures")
	quit(1 if failures else 0)
