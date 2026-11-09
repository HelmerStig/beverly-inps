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
			scene.select_character(slot,index)
			scene.reset_positions()
			var actor: Node2D=scene.fighters[slot]
			actor.frozen=true
			var duration: float=actor.animation_duration("crouch")
			var count: int=actor.data.animations.crouch.frames.size()
			actor.locomotion_step(0,0,false,false,true)
			check(actor.animation_id=="crouch" and actor.frame_index==0,"Crouch starts at first frame")
			for frame in range(count):
				if frame>0:actor.locomotion_step(1,duration/count,false,false,true)
				check(actor.frame_index==frame,"Lowering plays frame "+str(frame))
				check(actor.hurtboxes.animation_id=="crouch" and actor.hurtboxes.current_frame==frame,"Hurtbox tracks lowering frame")
				check(actor.hurtboxes.shapes.size()==actor.hurtboxes.current_parts.size(),"Native capsule count matches crouch geometry")
			actor.locomotion_step(0,duration/count,false,false,true)
			check(actor.crouch.state=="holding" and actor.frame_index==count-1,"Full descent reaches holding")
			actor.locomotion_step(1,1,false,true,true)
			check(actor.frame_index==count-1 and not actor.attack_active,"Last pose holds without standing attack")
			actor.locomotion_step(0,0,false,false,false)
			check(actor.crouch.state=="rising" and actor.frame_index==count-1,"Release starts reverse at last frame")
			for frame in range(count-2,-1,-1):
				actor.locomotion_step(0,duration/count,false,false,false)
				check(actor.frame_index==frame,"Reverse plays frame "+str(frame))
				check(actor.hurtboxes.current_frame==frame,"Hurtbox tracks reverse frame")
			actor.locomotion_step(0,duration/count,false,false,false)
			check(actor.animation_id=="idle" and not actor.crouch.is_active(),"Reverse returns to idle")
			# Releasing during anticipation must not truncate the down sequence.
			actor.locomotion_step(0,duration*.1,false,false,true)
			actor.locomotion_step(0,duration*.4,false,false,false)
			check(actor.crouch.state=="lowering","Short tap completes descent before reversal")
			actor.locomotion_step(0,duration*.5,false,false,false)
			check(actor.crouch.state=="rising" and actor.frame_index==count-1,"Short tap reaches last crouch frame")
			actor.locomotion_step(0,duration,false,false,false)
			check(actor.animation_id=="idle","Short tap completes full reverse")
			actor.locomotion_step(0,0,false,false,true)
			check(actor.locomotion_step(1,duration*2+.1,false,false,false)>0,"Unused grounded tick can resume movement")
			scene.reset_positions()
			actor.locomotion_step(0,.1,true,false,false)
			actor.locomotion_step(0,.01,false,false,true)
			check(actor.jump.active and not actor.crouch.is_active(),"Down cannot interrupt an airborne jump")
	# Actual keyboard bindings, independent for both players.
	for slot in range(2):
		scene.reset_positions()
		var event:=InputEventKey.new()
		event.physical_keycode=KEY_S if slot==0 else KEY_K
		event.pressed=true
		Input.parse_input_event(event)
		Input.flush_buffered_events()
		check(scene._crouch_held(slot),"Physical down key is detected")
		scene.movement_enabled=true
		for tick in range(24): await physics_frame
		check(scene.fighters[slot].crouch.state=="holding","Keyboard holds crouch")
		event=event.duplicate()
		event.pressed=false
		Input.parse_input_event(event)
		Input.flush_buffered_events()
		for tick in range(24): await physics_frame
		check(scene.fighters[slot].animation_id=="idle","Keyboard release returns to idle")
		scene.movement_enabled=false
	print("Crouch transition checks: ",failures," failures")
	quit(1 if failures else 0)
