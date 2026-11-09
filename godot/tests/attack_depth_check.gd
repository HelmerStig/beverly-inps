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
	for slot in range(2):
		for attack in ["light-punch","medium-punch","heavy-punch"]:
			scene.reset_positions()
			var actor: Node2D=scene.fighters[slot]
			var target: Node2D=scene.fighters[1-slot]
			actor.start_attack(attack)
			scene._update_view()
			check(actor.z_index>target.z_index,"Attacking player is in front: "+attack)
			check(actor.shadow_sprite.z_index==0 and not actor.shadow_sprite.z_as_relative,"Shadow stays at ground depth")
			check(actor.z_index+actor.hurtboxes.z_index<20,"Impact remains above fighter overlays")
			actor.locomotion_step(0,actor.animation_duration(attack))
			scene._update_view()
			check(actor.z_index==target.z_index,"Recovery restores normal depth")
			actor.start_attack(attack)
			scene.reset_positions()
			check(actor.z_index==target.z_index,"Reset restores normal depth")
	print("Attack depth checks: ",failures," failures")
	quit(1 if failures else 0)
