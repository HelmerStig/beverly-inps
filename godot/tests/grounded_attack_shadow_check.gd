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
			scene.select_character(slot,index)
			scene.reset_positions()
			var actor: Node2D=scene.fighters[slot]
			for attack in ["light-punch","medium-punch","heavy-punch","light-kick","medium-kick","heavy-kick","crouched-light-punch","crouched-medium-punch","crouched-heavy-punch"]:
				actor.start_attack(attack)
				var clock:=0.0
				for frame in range(actor.animation.frames.size()):
					if actor.animation.frameDurations[frame]==0:continue
					actor.elapsed=clock+.000001
					actor._update_frame()
					var error:=INF
					for foot: Dictionary in actor._feet():
						var point: Vector2=Vector2(foot.x,foot.y)-actor.anchor
						error=minf(error,actor.sprite.to_global(point).distance_to(actor.shadow_sprite.to_global(point)))
					check(error<.01,"Grounded attack shadow stays on planted sole: "+str(actor.data.id)+" "+attack+" "+str(frame))
					clock+=float(actor.animation.frameDurations[frame])/1000.0
			scene.reset_positions()
			actor.locomotion_step(0,.5,false,false,true)
			actor.locomotion_step(0,0,false,true,true)
			var visited: Array[int]=[]
			for tick in range(31):
				actor.locomotion_step(0,1.0/60.0,false,false,true)
				if actor.attack_active:visited.append(actor.frame_index)
			check(not actor.attack_active and actor.animation_id=="crouch","Crouched recovery returns to held pose")
			if actor.data.id=="peirolo":
				check(visited.has(9) and visited.has(10),"Peiro plays both final recovery frames at 60Hz")
				check(visited.count(9)>=2 and visited.count(10)>=2,"Peiro gives the retracting arm and guard visible recovery time")
	print("Grounded attack shadow checks: ",failures," failures")
	quit(1 if failures else 0)
