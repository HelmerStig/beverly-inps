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
		var p1: Node2D=scene.fighters[0]
		var p2: Node2D=scene.fighters[1]
		for facing in [false,true]:
			scene.reset_positions()
			p2.flipped=facing
			p1.world_x=p2.world_x+(-300 if facing else 300)
			key(scene,KEY_G)
			check(p2.training_guard and p2.animation_id=="idle" and not p2.guard_held,"G enables defense without guard pose")
			check(p2.locomotion_step(0,.02)==0 and not p2.guard_held,"No retreat without opponent attack")
			key(scene,KEY_G,true)
			check(p2.training_guard,"Key repeat ignored")
			p1.start_light_punch()
			var movement: float=p2.locomotion_step(0,.02)
			check(p2.guard_held and movement*(1 if facing else -1)>0,"Attack simulates backward input relative to facing")
			check(p2.receive_light_punch(p1) and p2.animation_id=="block-high","Actual contact enters high block")
			var frame: int=p2.frame_index
			p2.locomotion_step(0,.05)
			check(p2.frame_index==frame,"Contact guard holds until attack ends")
			p1.locomotion_step(0,1)
			p2.locomotion_step(0,.01)
			p2.locomotion_step(0,1)
			check(p2.animation_id=="idle" and not p2.guard_held,"Guard recovers to idle")
			key(scene,KEY_C)
			check(p2.training_crouch and p2.animation_id=="crouch" and not p2.guard_held,"C holds down without permanent block")
			p1.start_light_kick()
			check(p2.locomotion_step(0,.02)==0 and p2.guard_held,"Down-back keeps dummy crouched")
			check(p2.receive_light_punch(p1) and p2.animation_id=="block-low","Down-back blocks low kick")
			p1.locomotion_step(0,1)
			p2.locomotion_step(0,.01)
			p2.locomotion_step(0,1)
			check(p2.animation_id=="crouch" and not p2.guard_held,"Low guard recovers to held down")
			key(scene,KEY_G)
			check(not p2.training_guard and p2.training_crouch,"G disables auto defense preserving crouch")
			p1.start_light_kick()
			p2.locomotion_step(0,.02)
			check(not p2.receive_light_punch(p1),"Disabled automatic guard does not block")
			scene.reset_positions()
			check(not p2.training_guard and not p2.training_crouch,"Reset clears toggles")
	print("Dummy stance checks: ",failures," failures")
	quit(1 if failures else 0)
