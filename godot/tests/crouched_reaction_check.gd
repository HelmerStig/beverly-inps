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
			for attack in ["light-punch","medium-punch","heavy-punch","light-kick","medium-kick","heavy-kick","crouched-light-punch","crouched-medium-punch"]:
				for guard in [false,true]:
					for dummy in [false,true]:
						scene.reset_positions()
						var actor: Node2D=scene.fighters[slot]
						var target: Node2D=scene.fighters[1-slot]
						if dummy:
							target.set_training_stance(guard,true)
						else:
							target.locomotion_step(0,.5,false,false,true)
							target.guard_held=guard
						actor.start_attack(attack)
						check(target.receive_light_punch(actor)==guard,"Crouched defense classification")
						check(target.animation_id==("block-low" if guard else "hurt-crouched"),"Crouched reaction overrides attack height: "+str(index)+" "+attack)
						check(target.hurtboxes.animation_id==target.animation_id,"Crouched reaction hurtboxes match")
						if guard:
							var pose: int=target.frame_index
							target.locomotion_step(0,.05)
							check(target.frame_index==pose,"Crouched block pose held")
						else:
							target.receive_light_punch(actor)
							check(target.animation_id=="hurt-crouched","Repeated hit preserves crouched reaction")
						actor.locomotion_step(0,2)
						target.locomotion_step(0,.01)
						target.locomotion_step(0,2)
						check(target.reaction_kind.is_empty(),"Crouched recovery completes")
						check(target.animation_id==("crouch" if dummy else "idle"),"Recovery restores expected stance")
	print("Crouched reaction checks: ",failures," failures")
	quit(1 if failures else 0)
