extends SceneTree
const MOTION := preload("res://scenes/debug/locomotion.gd")
var failures := 0

func _initialize() -> void:
	call_deferred("_run")

func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _run() -> void:
	for facing_left in [false,true]:
		var axis := -1.0 if facing_left else 1.0
		var m := MOTION.new()
		m.step(axis,facing_left,0.016,0.5)
		check(m.state=="walk","First forward tap walks, relative to facing")
		for i in range(20):
			m.step(axis,facing_left,0.016,0.5)
		check(m.state=="walk","Holding forward does not count as a second tap")
		m.reset()
		m.step(axis,facing_left,0.016,0.5)
		m.step(0,facing_left,0.05,0.5)
		m.step(axis,facing_left,0.05,0.5)
		check(m.state=="run","Double forward starts running")
		m.step(axis,facing_left,1.0,0.5)
		check(m.state=="run","Run persists while forward is held")
		m.step(0,facing_left,0.016,0.5)
		check(m.state=="idle","Releasing forward ends running")
		m.step(axis,facing_left,0.016,0.5)
		check(m.state=="walk","After releasing run, a single press walks")
		m.reset()
		m.step(axis,facing_left,0.016,0.5)
		m.step(0,facing_left,0.3,0.5)
		m.step(axis,facing_left,0.016,0.5)
		check(m.state=="walk","Late second tap does not run")
		m.reset()
		m.step(-axis,facing_left,0.016,0.5)
		check(m.state=="backwalk","Single back tap walks backward")
		m.step(0,facing_left,0.05,0.5)
		m.step(-axis,facing_left,0.05,0.5)
		check(m.state=="back-jump","Double back starts back jump")
		var displacement := 0.0
		for i in range(60):
			displacement += m.step(0,facing_left,1.0/120.0,0.5)
		check(m.state=="idle","Back jump finishes even after direction is released")
		check(is_equal_approx(displacement,-axis*MOTION.HOP_SPEED*0.5),"Back jump distance is frame-rate independent")
		check(MOTION.HOP_SPEED>MOTION.WALK_SPEED and MOTION.HOP_SPEED>MOTION.BACK_SPEED,"Back jump movement is faster than walking")
	var scene: Control = load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	scene.movement_enabled = false
	await process_frame
	for slot in range(2):
		for index in range(7):
			scene.select_character(slot,index)
			var fighter: Node2D = scene.fighters[slot]
			fighter.frozen = true
			for id in ["idle","walk","backwalk","run","back-jump"]:
				fighter.set_animation(id,true)
				var duration: float = fighter.animation_duration(id)
				check(duration>0,"Animation has positive duration")
				for progress in [0.0,0.5,0.999]:
					fighter.elapsed = duration*progress
					fighter._update_frame()
					check(fighter.frame_index>=0 and fighter.frame_index<fighter.animation.frames.size(),"Frame selection stays inside source atlas")
					check(fighter.sprite.texture!=null,"Movement sheet loads")
					check(not fighter.hurtboxes.current_parts.is_empty(),"Every locomotion pose has hurtboxes")
					check(fighter.hurtboxes.animation_id==id,"Hurtbox animation matches sprite")
					check(fighter.hurtboxes.scale==fighter.sprite.scale,"Hurtboxes match the current animation scale and flip")
				var time := 0.0
				for frame in range(fighter.animation.frames.size()):
					fighter.elapsed = time+0.00001
					fighter._update_frame()
					check(fighter.frame_index==frame,"Hurtboxes select the exact sprite frame")
					check(fighter.hurtboxes.current_parts==fighter.hurtboxes.frame_data[frame],"Collision data matches current frame")
					for shape: CollisionShape2D in fighter.hurtboxes.shapes:
						check(not shape.disabled and shape.shape.radius>0,"Current pose capsules are active")
					if id in ["run","back-jump"]:
						check(is_zero_approx(fighter.shadow_sprite.transform.x.y),"Locomotion shadow ground plane stays horizontal")
						check(is_equal_approx(fighter.shadow_sprite.transform.y.y,-0.11*fighter.visual_scale),"Shadow flattening does not rotate with raised feet")
					if id in ["walk","backwalk"]:
						var feet: Array = fighter._feet()
						var support: Dictionary = feet[0]
						for foot: Dictionary in feet:
							if float(foot.y)>float(support.y):
								support = foot
						var point: Vector2 = Vector2(support.x,support.y)-fighter.anchor
						var projected: Vector2 = fighter.shadow_sprite.transform*point
						var actual: Vector2 = point*fighter.sprite.scale
						check(projected.distance_to(actual)<0.01,"Walking shadow is attached to the support sole on both facing sides")
					time += float(fighter.animation.frameDurations[frame])/1000.0 if fighter.animation.has("frameDurations") else 1.0/float(fighter.animation.playbackFps)
	for index in range(7):
		scene.select_character(0,index)
		scene.select_character(1,(index+1)%7)
		for id in ["walk","backwalk","run","back-jump"]:
			scene.reset_positions()
			for fighter in scene.fighters:
				fighter.set_animation(id)
				fighter.frozen = true
				fighter.elapsed = fighter.animation_duration(id)*0.37
				fighter._update_frame()
			scene.move_pair(Vector2(10000,-10000))
			check(scene.fighters[0].world_x<scene.fighters[1].world_x,"Current-pose contact prevents crossing")
			for first: CollisionShape2D in scene.fighters[0].hurtboxes.shapes:
				for second: CollisionShape2D in scene.fighters[1].hurtboxes.shapes:
					check(not first.shape.collide(first.global_transform,second.shape,second.global_transform),"Locomotion capsules do not penetrate at contact")
	scene.select_character(0,0)
	scene.select_character(1,2)
	scene.reset_positions()
	scene.fighters[0].set_animation("run")
	scene.fighters[1].set_animation("backwalk")
	scene.set_hurtboxes_visible(true)
	for fighter in scene.fighters:
		fighter.frozen = true
		fighter.elapsed = 0.35
		fighter._update_frame()
	if DisplayServer.get_name()!="headless":
		scene._update_view()
		await create_timer(0.3).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/locomotion-screen.png")
		for fighter in scene.fighters:
			fighter.set_animation("back-jump")
			fighter.elapsed = fighter.animation_duration("back-jump")*0.65
			fighter._update_frame()
		scene._update_view()
		await create_timer(0.2).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/back-jump-screen.png")
	print("Locomotion checks: ",failures," failures")
	quit(1 if failures else 0)
