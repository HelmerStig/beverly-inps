extends SceneTree
var failures := 0
func _initialize() -> void:
	call_deferred("run")
func check(value: bool, label: String) -> void:
	if not value:
		failures += 1
		push_error(label)
func key(scene: Control, code: Key, echo: bool=false) -> void:
	var event := InputEventKey.new()
	event.keycode=code
	event.pressed=true
	event.echo=echo
	scene._input(event)
func run() -> void:
	var scene=load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled=false
	await process_frame
	for index in range(7):
		scene.select_character(1,index)
		var p2: Node2D=scene.fighters[1]
		key(scene,KEY_G)
		check(p2.training_guard and p2.animation_id=="block-high","G enters high guard")
		var frame: int=p2.frame_index
		p2.locomotion_step(1.0,1.0,true,true)
		check(p2.frame_index==frame and not p2.attack_active and not p2.jump.active,"Guard holds and locks dummy movement")
		key(scene,KEY_G,true)
		check(p2.training_guard,"Key repeat does not toggle")
		key(scene,KEY_G)
		check(not p2.training_guard and p2.animation_id=="idle","G releases guard")
		key(scene,KEY_C)
		check(p2.training_crouch and p2.animation_id=="crouch","C enters crouch")
		check(p2.frame_index==p2.animation.frames.size()-1,"C holds full crouched pose")
		key(scene,KEY_G)
		check(p2.training_crouch and p2.training_guard and p2.animation_id=="block-low","C plus G enters low guard")
		p2.locomotion_step(0.0,2.0)
		check(p2.animation_id=="block-low" and p2.guard_held,"Low guard persists")
		key(scene,KEY_G)
		check(p2.animation_id=="crouch" and not p2.training_guard,"G releases low guard into crouch")
		key(scene,KEY_C)
		check(p2.animation_id=="idle" and not p2.training_crouch,"C releases crouch")
		key(scene,KEY_G)
		key(scene,KEY_C)
		check(p2.animation_id=="block-low","G then C also enters low guard")
		key(scene,KEY_C)
		check(p2.animation_id=="block-high","C releases crouch but keeps guard")
		check(scene.fighters[0].animation_id=="idle","Player 1 unaffected")
		scene.reset_positions()
		check(not p2.training_guard and not p2.training_crouch,"Reset clears dummy stance")
	print("Dummy stance checks: ",failures," failures")
	quit(1 if failures else 0)
