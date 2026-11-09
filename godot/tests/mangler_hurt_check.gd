extends SceneTree
var failures := 0
func _initialize() -> void:
	call_deferred("run")
func check(value: bool,label: String) -> void:
	if not value:
		failures+=1
		push_error(label)
func sole(actor: Node2D) -> Vector2:
	var foot: Dictionary=actor._planted_foot()
	return actor.to_global((Vector2(foot.x,foot.y)-actor.anchor)*actor.sprite.scale)
func run() -> void:
	var scene=load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled=false
	await process_frame
	for slot in range(2):
		scene.select_character(slot,2)
		scene.reset_positions()
		var target: Node2D=scene.fighters[slot]
		var attacker: Node2D=scene.fighters[1-slot]
		for f in scene.fighters:f.frozen=true
		var before: Vector2=sole(target)
		var world_x: float=target.world_x
		attacker.start_light_punch()
		check(not target.receive_light_punch(attacker),"Mangler receives unguarded hurt")
		for frame in range(16):
			target.elapsed=frame*.03125+.000001
			target._update_frame()
			check(sole(target).distance_to(before)<.01,"Planted foot stable during hurt frame "+str(frame)+" facing "+str(slot))
			check(target.world_x==world_x,"Hurt does not displace actor")
			check(target.hurtboxes.anchor==target.anchor and target.sprite.offset==-target.anchor,"Sprite and hurt geometry share pivot")
		target._reaction_step(.5)
		check(target.animation_id=="idle" and not target.hurt_plant_locked,"Recovery restores normal idle pivot")
		check(sole(target).distance_to(before)<.01,"Idle recovery has no sliding")
	print("Mangler hurt alignment checks: ",failures," failures")
	quit(1 if failures else 0)
