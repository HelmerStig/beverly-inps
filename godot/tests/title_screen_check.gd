extends SceneTree
## Run with a real renderer to compile shaders and capture the actual frame.
var failures := 0

func _initialize() -> void:
	call_deferred("_run")

func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _run() -> void:
	var title := load("res://scenes/title/title_screen.tscn").instantiate() as Control
	root.add_child(title)
	title.mode_selected.disconnect(title._on_mode_selected)
	await process_frame
	check(title.background.textures.size() == 10, "All ten UI layers must load")
	check(title.pipeline.viewports.size() == 7, "CRT must use seven explicit render passes")
	for material: ShaderMaterial in title.pipeline.materials.values():
		check(not material.shader.get_shader_uniform_list().is_empty(), "Shader must compile: " + material.shader.resource_path)
	check(title.pipeline.materials.Phosphor.get_shader_parameter("brightnessBoost") == 3.0, "Canonical CRT preset must be applied")
	var started := [0]
	title.start_requested.connect(func(): started[0] += 1)
	var enter := InputEventKey.new()
	enter.keycode = KEY_ENTER
	enter.pressed = true
	root.push_input(enter)
	await process_frame
	check(started[0] == 1, "Enter emits start without loading an unfinished scene")
	check(title.main_menu.visible and not title.press_start_label.visible, "Enter opens the menu and hides the prompt")
	check(title.interface_viewport.gui_get_focus_owner() == title.menu_buttons[0], "First menu item receives keyboard/joypad focus")
	check(title.menu_buttons.map(func(button: Button): return button.text) == ["Single Player", "Versus", "Debug"], "All three requested menu items exist")
	var selected: Array[StringName] = []
	title.mode_selected.connect(func(mode: StringName): selected.append(mode))
	for button: Button in title.menu_buttons:
		button.pressed.emit()
	check(selected == [&"single_player", &"versus", &"debug"], "Each menu button emits its own mode")
	title._process(0.6)
	check(not title.press_start_label.visible, "Blink does not reveal prompt over menu")
	var back := InputEventJoypadButton.new()
	back.button_index = JOY_BUTTON_B
	back.pressed = true
	root.push_input(back)
	await process_frame
	check(not title.main_menu.visible and title.press_start_label.visible, "Joypad B returns to title")
	check(title.interface_viewport.gui_get_focus_owner() == null, "Returning releases hidden menu focus")
	title.background.frozen = true
	title.background.elapsed = 0.0
	title.pipeline.frozen = true
	title.pipeline.clock = 0.0
	# Let render dependencies warm up, and the logo entrance settle.
	await create_timer(1.2).timeout
	DirAccess.make_dir_recursive_absolute("res://tests/artifacts")
	FileAccess.open("res://tests/artifacts/.gdignore", FileAccess.WRITE).close()
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/title-screen.png")
		title._show_menu()
		for frame in range(10):
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://tests/artifacts/menu-screen.png")
		check(title.menu_buttons[0].get_viewport() == title.background.get_viewport(), "Menu and background share the CRT source")
		# Check actual GUI routing through the container, not just signal handlers.
		var down := InputEventKey.new()
		down.keycode = KEY_DOWN
		down.pressed = true
		root.push_input(down)
		await process_frame
		check(title.interface_viewport.gui_get_focus_owner() == title.menu_buttons[1], "Keyboard navigation reaches the filtered menu")
		title._hide_menu()
		title.contents.visible = false
		for frame in range(10):
			await process_frame
		await RenderingServer.frame_post_draw
		var filtered: Image = title.pipeline.output.get_image()
		check(filtered.get_size() == Vector2i(1920,1080), "CRT output is 1080p")
		check(filtered.get_pixel(960,540).get_luminance() > 0.02, "CRT output must not be black")
		filtered.save_png("res://tests/artifacts/ui-crt.png")
		if FileAccess.file_exists("res://tests/artifacts/browser-reference.png"):
			var reference := Image.load_from_file("res://tests/artifacts/browser-reference.png")
			var error := 0.0
			var samples := 0
			for y in range(0,1080,5):
				for x in range(0,1920,5):
					var a := filtered.get_pixel(x,y)
					var b := reference.get_pixel(x,y)
					error += absf(a.r-b.r) + absf(a.g-b.g) + absf(a.b-b.b)
					samples += 3
			var mean_error := error / samples
			print("Browser/Godot sampled RGB mean absolute error: ", mean_error)
			check(mean_error < 0.03, "Godot CRT must stay close to the browser reference at 1080p")
		title.pipeline.source.get_image().save_png("res://tests/artifacts/ui-source.png")
		root.get_texture().get_image().save_png("res://tests/artifacts/background-window.png")
		title.contents.visible = true
	title.set_effects_enabled(false)
	check(title.display.texture == title.pipeline.source, "Original view bypasses CRT")
	check(not title.background.effects_enabled, "Original view disables haze and dust")
	title.set_effects_enabled(true)
	check(title.display.texture == title.pipeline.output, "CRT view can be restored")
	print("Title screen checks: ", failures, " failures")
	quit(1 if failures else 0)
