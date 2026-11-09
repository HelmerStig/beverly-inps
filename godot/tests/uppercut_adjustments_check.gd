extends SceneTree
var failures:=0
func check(value: bool,label: String) -> void:
	if not value:
		failures+=1
		push_error(label)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	var scene=load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled=false
	await process_frame
	for slot in range(2):
		for index in range(7):
			scene.select_character(slot,6)
			scene.select_character(1-slot,index)
			scene.reset_positions()
			scene.move_pair(Vector2(10000,0) if slot==0 else Vector2(0,-10000))
			var a=scene.fighters[slot]
			var t=scene.fighters[1-slot]
			a.locomotion_step(0,0,false,false,true,false,true)
			a.locomotion_step(0,.5)
			scene._update_view()
			check(a.resolve_light_punch(t),"Torpe hits standing opponent at contact: "+str(t.data.id))
			check(t.animation_id=="hurt-high","Torpe uppercut causes high hurt")
	for slot in range(2):
		scene.select_character(slot,2)
		scene.reset_positions()
		var a=scene.fighters[slot]
		var t=scene.fighters[1-slot]
		a.locomotion_step(0,0,false,false,true,false,true)
		check(a.uppercut_hop_active,"Mangler uppercut starts hop")
		a.locomotion_step(0,.25)
		check(absf(a.body_y+150)<.01,"Mangler leaves ground immediately")
		a.locomotion_step(0,.25)
		scene._update_view()
		check(absf(a.body_y+200)<.01,"Mangler hop apex is 200px")
		check(absf(a.hurtboxes.global_position.y-a.position.y)<.01,"Hurtboxes rise with Mangler")
		var min_error:=INF
		for foot: Dictionary in a._feet():
			var point: Vector2=Vector2(foot.x,foot.y)-a.anchor
			min_error=minf(min_error,absf(a.shadow_sprite.to_global(point).y-(1025.0)))
		check(min_error<.01,"Mangler shadow stays on ground during hop")
		a.locomotion_step(0,.5)
		check(a.body_y==0 and not a.uppercut_hop_active and not a.attack_active,"Hop lands at the end of full attack recovery")
		scene.reset_positions()
		a.start_attack("crouched-heavy-punch")
		a.locomotion_step(0,.5)
		t.start_light_punch()
		a.receive_light_punch(t)
		a.locomotion_step(0,.25)
		check(absf(a.body_y+150)<.01,"Interrupted uppercut continues descending")
		a.locomotion_step(0,.25)
		check(a.body_y==0 and not a.uppercut_hop_active,"Interrupted uppercut lands")
		scene.reset_positions()
		a.start_attack("crouched-heavy-punch")
		for tick in range(120):
			a.locomotion_step(0,1.0/120.0)
			scene._update_view()
			var lowest: float=-INF
			for foot: Dictionary in a._feet():
				lowest=maxf(lowest,a.sprite.to_global(Vector2(foot.x,foot.y)-a.anchor).y)
			check(lowest<=1026.0,"Animated right foot never crosses ground during longer hop")
		a.start_attack("crouched-heavy-punch")
		a.locomotion_step(0,.1)
		scene.reset_positions()
		check(a.body_y==0 and not a.uppercut_hop_active,"Reset clears uppercut hop")
	print("Uppercut adjustments checks: ",failures," failures")
	quit(1 if failures else 0)
