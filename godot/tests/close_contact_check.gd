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
			for attack in ["light-punch","medium-punch","heavy-punch","light-kick","medium-kick","heavy-kick","crouched-light-punch","crouched-medium-punch"]:
				for guard in [false,true]:
					scene.reset_positions()
					var actor: Node2D=scene.fighters[slot]
					var target: Node2D=scene.fighters[1-slot]
					target.set_training_stance(guard,guard)
					actor.start_attack(attack)
					actor.locomotion_step(0,float(actor.animation.impactMs)/1000.0)
					scene._update_view()
					var foot: Vector2=actor.hitbox.shape.global_position
					var inward: Vector2=actor.hitbox.global_transform*Vector2(0,actor.hitbox.shape.position.y)
					var probe:=CollisionShape2D.new()
					probe.shape=CircleShape2D.new()
					probe.shape.radius=2
					root.add_child(probe)
					probe.global_position=inward.lerp(foot,.4)
					target.hurtboxes.shapes.clear()
					target.hurtboxes.shapes.append(probe)
					check(not actor.hitbox.touches(target.hurtboxes),"Extended tip passes close target: "+attack)
					check(actor.resolve_light_punch(target),"Close contact resolves: "+str(index)+" "+attack)
					var expected: String="block-low" if guard else "hurt-low" if attack=="light-kick" else "hurt-medium" if attack in ["medium-punch","heavy-punch","medium-kick","crouched-light-punch","crouched-medium-punch"] or (attack=="heavy-kick" and actor.data.id=="arianna") else "hurt-high"
					check(target.animation_id==expected,"Close contact chooses correct hurt/block: "+attack)
					check(not actor.resolve_light_punch(target),"Close contact only hits once")
					probe.queue_free()
	print("Close contact checks: ",failures," failures")
	quit(1 if failures else 0)
