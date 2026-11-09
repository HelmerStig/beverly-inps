extends SceneTree
var failures := 0
func _initialize() -> void:
	call_deferred("run")
func check(value: bool, label: String) -> void:
	if not value:
		failures += 1
		push_error(label)
func run() -> void:
	var scene=load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled=false
	await process_frame
	for slot in range(2):
		for blocked in [false,true]:
			scene.select_character(0,0)
			scene.select_character(1,0)
			scene.reset_positions()
			await process_frame
			for actor in scene.fighters: actor.frozen=true
			var attacker: Node2D=scene.fighters[slot]
			var target: Node2D=scene.fighters[1-slot]
			attacker.start_light_punch()
			attacker.locomotion_step(0.0,.3)
			check(not attacker.resolve_light_punch(target) and scene.impact_effects.get_child_count()==0,"Miss produces no effect")
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			target.guard_held=blocked
			attacker.start_light_punch()
			attacker.locomotion_step(0.0,.3)
			scene._update_view()
			var point: Vector2=attacker.hitbox.contact_point(target.hurtboxes)
			check(attacker.resolve_light_punch(target),"Actual contact resolves")
			check(scene.impact_effects.get_child_count()==1,"One contact creates one effect")
			var effect: Node2D=scene.impact_effects.get_child(0)
			check(effect.blocked==blocked,"Effect distinguishes hit and block")
			check(effect.direction==(-1.0 if slot==1 else 1.0),"Effect mirrors with attacker")
			check(effect.global_position.distance_to(point)<3.0,"Effect uses native collision contact")
			check(not attacker.resolve_light_punch(target) and scene.impact_effects.get_child_count()==1,"No duplicate effect")
			var world: Vector2=effect.position
			scene.camera_x+=20
			scene._update_view()
			check(effect.position==world and absf(effect.global_position.x-(world.x-scene.camera_x))<.001,"Effect stays at world contact during camera scroll")
			effect.set_process(false)
			effect.age=.035
			effect.queue_redraw()
			if slot==0 and DisplayServer.get_name()!="headless":
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png("res://tests/artifacts/impact-block.png" if blocked else "res://tests/artifacts/impact-hit.png")
			effect._process(.3)
			await process_frame
			check(scene.impact_effects.get_child_count()==0,"Effect expires cleanly")
	print("Impact effect checks: ",failures," failures")
	quit(1 if failures else 0)
