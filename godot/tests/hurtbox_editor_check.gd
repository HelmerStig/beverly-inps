extends SceneTree
var failures := 0
func _initialize() -> void:
	call_deferred("run")
func check(value: bool, label: String) -> void:
	if not value:
		failures += 1
		push_error(label)
func run() -> void:
	var scene = load("res://scenes/debug/debug_screen.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	var editor = scene.hurtbox_editor
	editor.toggle()
	check(editor.active and scene.fighters[0].frozen,"Editor pauses gameplay")
	for character in range(7):
		scene.select_character(0,character)
		for id in editor.fighter().data.animations:
			editor.fighter().set_animation(id,true)
			editor.show_frame(editor.fighter().animation.frames.size()-1)
			check(editor.fighter().frame_index==editor.fighter().animation.frames.size()-1,"Last frame: "+id)
			editor.show_frame(0)
	scene.select_character(0,0)
	var rig = editor.rig()
	var backup: Dictionary = rig.overrides.duplicate(true)
	var count: int = rig.current_parts.size()
	editor.add_capsule()
	check(rig.current_parts.size()==count+1 and rig.shapes.size()==count+1,"Added capsule has actual collision shape")
	editor.values[4].value = 23
	check(rig.current_parts[-1].capsule[4]==23,"Numeric edit updates geometry")
	editor.undo()
	check(rig.current_parts[-1].capsule[4]==15,"Undo restores radius")
	editor.delete_capsule()
	check(rig.current_parts.size()==count,"Delete removes collision shape")
	editor.undo()
	check(rig.current_parts.size()==count+1,"Undo deletion")
	# Verify disk persistence, preserving any existing manual work.
	var path: String = rig.OVERRIDE_PATH
	var existed := FileAccess.file_exists(path)
	var original := FileAccess.get_file_as_string(path) if existed else ""
	editor.save()
	check(not editor.dirty,"Successful save clears dirty state")
	var stored = JSON.parse_string(FileAccess.get_file_as_string(path))
	check(stored[rig.frame_key(0)].size()==count+1,"Saved frame can be loaded from disk")
	rig.overrides = stored
	rig.update_frame(0)
	check(rig.current_parts.size()==count+1,"Reload uses saved overrides")
	editor.restore_frame()
	check(rig.current_parts.size()==count,"Restore uses generated geometry")
	rig.overrides = backup
	rig.update_frame(0)
	if existed:
		var file := FileAccess.open(path,FileAccess.WRITE)
		file.store_string(original)
		file.close()
	else:
		DirAccess.remove_absolute(path)
	editor.selected = 0
	editor._refresh_list()
	await process_frame
	if DisplayServer.get_name()!="headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/hurtbox-editor.png")
	editor.toggle()
	check(not editor.active and not scene.fighters[0].frozen and scene.fighters[1].visible,"Closing restores gameplay")
	print("Hurtbox editor checks: ",failures," failures")
	quit(1 if failures else 0)
