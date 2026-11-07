extends Control
## Title and main menu. Future mode screens connect to mode_selected.

signal start_requested
signal mode_selected(mode: StringName)

const BACKGROUND := preload("res://scenes/title/title_background.gd")
const PIPELINE := preload("res://scenes/title/crt_pipeline.gd")
const TITLE_LOGO := preload("res://assets/ui/title-logo.png")
const OSWALD_FONT := preload("res://assets/fonts/Oswald-Variable.ttf")
const LOGO_SIZE := Vector2(704.0, 384.0)
const LOGO_CENTER_OFFSET := Vector2(0.0, -60.0)
const LOGO_IMPACT_TIME := 0.48
const BLINK_INTERVAL := 0.55

var background: Node2D
var pipeline: Node
var display: TextureRect
var contents: Control
var press_start_label: Label
var main_menu: VBoxContainer
var menu_buttons: Array[Button] = []
var title_logo: TextureRect
var neon_subtitle: Label
var neon_subtitle_glow: Label
var blink_accum := 0.0
var neon_flicker_time := 0.7
var neon_flicker_steps := 0
var neon_enabled := false
var neon_random := RandomNumberGenerator.new()

func _ready() -> void:
	neon_random.randomize()
	var viewport := SubViewport.new()
	viewport.name = "BackgroundSource"
	viewport.size = Vector2i(1920, 1080)
	viewport.disable_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	background = BACKGROUND.new()
	viewport.add_child(background)
	pipeline = PIPELINE.new()
	add_child(pipeline)
	pipeline.build(viewport.get_texture())
	display = TextureRect.new()
	display.name = "FilteredBackground"
	display.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	display.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	display.texture = pipeline.output
	display.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(display)
	contents = Control.new()
	contents.name = "TitleContents"
	contents.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	contents.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(contents)
	_build_contents()

func _build_contents() -> void:
	_add_animated_logo()
	_add_neon_subtitle()
	press_start_label = Label.new()
	press_start_label.text = "PRESS ENTER TO START"
	press_start_label.set_anchors_preset(Control.PRESET_CENTER)
	press_start_label.position = Vector2(-280.0, LOGO_SIZE.y * 0.5 - 20.0)
	press_start_label.size = Vector2(560.0, 48.0)
	press_start_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	press_start_label.add_theme_font_override("font", OSWALD_FONT)
	press_start_label.add_theme_font_size_override("font_size", 28)
	contents.add_child(press_start_label)
	_build_menu()

func _build_menu() -> void:
	main_menu = VBoxContainer.new()
	main_menu.name = "MainMenu"
	main_menu.set_anchors_preset(Control.PRESET_CENTER)
	main_menu.position = Vector2(-240.0, 155.0)
	main_menu.size = Vector2(480.0, 0.0)
	main_menu.add_theme_constant_override("separation", 12)
	main_menu.visible = false
	contents.add_child(main_menu)
	var labels := ["Single Player", "Versus", "Debug"]
	var modes: Array[StringName] = [&"single_player", &"versus", &"debug"]
	for index in range(labels.size()):
		var button := Button.new()
		button.name = str(modes[index]).to_pascal_case()
		button.text = labels[index]
		button.custom_minimum_size = Vector2(480, 64)
		button.add_theme_font_override("font", OSWALD_FONT)
		button.add_theme_font_size_override("font_size", 34)
		button.add_theme_color_override("font_focus_color", Color("a4f3ff"))
		var panel := StyleBoxFlat.new()
		panel.bg_color = Color(0.025, 0.045, 0.08, 0.85)
		panel.set_corner_radius_all(8)
		panel.set_border_width_all(1)
		panel.border_color = Color(0.4, 0.75, 0.85, 0.55)
		button.add_theme_stylebox_override("normal", panel)
		var highlighted := panel.duplicate() as StyleBoxFlat
		highlighted.bg_color = Color(0.05, 0.19, 0.26, 0.95)
		highlighted.border_color = Color("a4f3ff")
		highlighted.set_border_width_all(2)
		for state in ["hover", "pressed", "focus"]:
			button.add_theme_stylebox_override(state, highlighted)
		button.pressed.connect(func(): mode_selected.emit(modes[index]))
		main_menu.add_child(button)
		menu_buttons.append(button)
	for index in range(menu_buttons.size()):
		var button := menu_buttons[index]
		button.focus_neighbor_top = button.get_path_to(menu_buttons[posmod(index - 1, menu_buttons.size())])
		button.focus_neighbor_bottom = button.get_path_to(menu_buttons[(index + 1) % menu_buttons.size()])

func _show_menu() -> void:
	main_menu.show()
	press_start_label.hide()
	menu_buttons[0].grab_focus()
	start_requested.emit()

func _hide_menu() -> void:
	var focused := get_viewport().gui_get_focus_owner()
	if focused != null:
		focused.release_focus()
	main_menu.hide()
	blink_accum = 0.0
	press_start_label.show()

func _process(delta: float) -> void:
	_update_broken_neon(delta)
	blink_accum += delta
	if not main_menu.visible and blink_accum >= BLINK_INTERVAL:
		blink_accum = 0.0
		press_start_label.visible = not press_start_label.visible

func set_effects_enabled(value: bool) -> void:
	pipeline.set_enabled(value)
	background.effects_enabled = value
	display.texture = pipeline.output if value else pipeline.source

func _input(event: InputEvent) -> void:
	# Handle back before a focused menu button consumes GUI input.
	var joypad_back: bool = event is InputEventJoypadButton and event.pressed and event.button_index == JOY_BUTTON_B
	if main_menu.visible and (joypad_back or event.is_action_pressed("ui_cancel")):
		_hide_menu()
		get_viewport().set_input_as_handled()

func _unhandled_input(event: InputEvent) -> void:
	if not main_menu.visible and (event.is_action_pressed("ui_accept") or (event is InputEventJoypadButton and event.pressed and event.button_index == JOY_BUTTON_START)):
		_show_menu()
		get_viewport().set_input_as_handled()
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F11:
			var mode := DisplayServer.window_get_mode()
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if mode == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)
		elif event.keycode == KEY_F8:
			set_effects_enabled(not pipeline.enabled)

# Logo entrance and broken neon animation follow the legacy TitleScreen.
func _add_animated_logo() -> void:
	title_logo = TextureRect.new()
	title_logo.name = "TitleLogo"
	title_logo.texture = TITLE_LOGO
	title_logo.set_anchors_preset(Control.PRESET_CENTER)
	var final_left := -LOGO_SIZE.x * 0.5 + LOGO_CENTER_OFFSET.x
	var final_top := -LOGO_SIZE.y * 0.5 + LOGO_CENTER_OFFSET.y
	title_logo.offset_left = final_left
	title_logo.offset_right = final_left + LOGO_SIZE.x
	title_logo.offset_top = final_top - 340.0
	title_logo.offset_bottom = final_top - 340.0 + LOGO_SIZE.y
	title_logo.pivot_offset = LOGO_SIZE * 0.5
	title_logo.scale = Vector2(1.38, 1.38)
	title_logo.rotation = deg_to_rad(-14.0)
	title_logo.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	title_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	title_logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	title_logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title_logo.z_index = 2
	contents.add_child(title_logo)
	var impact_tween := create_tween().set_parallel(true)
	impact_tween.set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_IN)
	impact_tween.tween_property(title_logo, "offset_top", final_top, LOGO_IMPACT_TIME)
	impact_tween.tween_property(title_logo, "offset_bottom", final_top + LOGO_SIZE.y, LOGO_IMPACT_TIME)
	impact_tween.tween_property(title_logo, "scale", Vector2.ONE, LOGO_IMPACT_TIME)
	impact_tween.tween_property(title_logo, "rotation", deg_to_rad(2.0), LOGO_IMPACT_TIME)
	var settle_tween := create_tween()
	settle_tween.tween_interval(LOGO_IMPACT_TIME)
	settle_tween.set_parallel(true)
	settle_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	settle_tween.tween_property(title_logo, "scale", Vector2(1.045, 1.045), 0.1)
	settle_tween.tween_property(title_logo, "rotation", 0.0, 0.1)
	settle_tween.chain().set_parallel(true)
	settle_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	settle_tween.tween_property(title_logo, "scale", Vector2.ONE, 0.14)
	get_tree().create_timer(LOGO_IMPACT_TIME).timeout.connect(_on_logo_impact)


func _add_neon_subtitle() -> void:
	var subtitle_position := Vector2(-280.0, LOGO_SIZE.y * 0.5 - 150.0)
	neon_subtitle_glow = Label.new()
	neon_subtitle_glow.name = "BeverlyINPSGlow"
	neon_subtitle_glow.text = "Beverly INPS"
	neon_subtitle_glow.set_anchors_preset(Control.PRESET_CENTER)
	neon_subtitle_glow.position = subtitle_position
	neon_subtitle_glow.size = Vector2(560.0, 70.0)
	neon_subtitle_glow.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	neon_subtitle_glow.add_theme_font_override("font", OSWALD_FONT)
	neon_subtitle_glow.add_theme_font_size_override("font_size", 58)
	neon_subtitle_glow.add_theme_color_override("font_color", Color(0.82, 0.97, 1.0, 0.1))
	neon_subtitle_glow.add_theme_color_override("font_outline_color", Color(0.15, 0.86, 1.0, 0.35))
	neon_subtitle_glow.add_theme_constant_override("outline_size", 12)
	neon_subtitle_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	neon_subtitle_glow.z_index = 3
	neon_subtitle_glow.modulate.a = 0.0
	contents.add_child(neon_subtitle_glow)

	neon_subtitle = Label.new()
	neon_subtitle.name = "BeverlyINPS"
	neon_subtitle.text = "Beverly INPS"
	neon_subtitle.set_anchors_preset(Control.PRESET_CENTER)
	neon_subtitle.position = subtitle_position
	neon_subtitle.size = Vector2(560.0, 70.0)
	neon_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	neon_subtitle.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	neon_subtitle.add_theme_font_override("font", OSWALD_FONT)
	neon_subtitle.add_theme_font_size_override("font_size", 58)
	neon_subtitle.add_theme_color_override("font_color", Color.WHITE)
	neon_subtitle.add_theme_color_override("font_outline_color", Color(0.58, 0.94, 1.0, 0.95))
	neon_subtitle.add_theme_color_override("font_shadow_color", Color(0.04, 0.54, 0.86, 0.9))
	neon_subtitle.add_theme_constant_override("outline_size", 2)
	neon_subtitle.add_theme_constant_override("shadow_offset_x", 0)
	neon_subtitle.add_theme_constant_override("shadow_offset_y", 2)
	neon_subtitle.mouse_filter = Control.MOUSE_FILTER_IGNORE
	neon_subtitle.z_index = 4
	neon_subtitle.modulate.a = 0.0
	contents.add_child(neon_subtitle)


func _on_logo_impact() -> void:
	if not is_inside_tree():
		return
	var impact_center := get_viewport_rect().size * 0.5 + LOGO_CENTER_OFFSET
	var shockwave := Line2D.new()
	shockwave.name = "LogoShockwave"
	shockwave.position = impact_center
	shockwave.width = 7.0
	shockwave.default_color = Color(1.0, 0.64, 0.24, 0.9)
	shockwave.points = _make_shockwave_points()
	shockwave.scale = Vector2(0.25, 0.25)
	shockwave.z_index = 1
	contents.add_child(shockwave)
	var shockwave_tween := create_tween().set_parallel(true)
	shockwave_tween.set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
	shockwave_tween.tween_property(shockwave, "scale", Vector2(1.65, 0.86), 0.36)
	shockwave_tween.tween_property(shockwave, "modulate:a", 0.0, 0.36)
	shockwave_tween.tween_callback(shockwave.queue_free).set_delay(0.38)

	var dust := CPUParticles2D.new()
	dust.name = "LogoImpactDust"
	dust.position = impact_center + Vector2(0.0, LOGO_SIZE.y * 0.5)
	dust.amount = 42
	dust.one_shot = true
	dust.explosiveness = 1.0
	dust.lifetime = 0.65
	dust.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	dust.emission_rect_extents = Vector2(220.0, 10.0)
	dust.direction = Vector2.UP
	dust.spread = 80.0
	dust.initial_velocity_min = 55.0
	dust.initial_velocity_max = 185.0
	dust.gravity = Vector2(0.0, 240.0)
	dust.scale_amount_min = 1.8
	dust.scale_amount_max = 4.5
	dust.color = Color(1.0, 0.7, 0.32, 0.82)
	dust.z_index = 3
	dust.emitting = true
	contents.add_child(dust)
	get_tree().create_timer(0.9).timeout.connect(dust.queue_free)

	neon_enabled = true
	neon_flicker_time = 0.12
	_set_neon_lit(true)


func _make_shockwave_points() -> PackedVector2Array:
	var points := PackedVector2Array()
	for point_index in range(25):
		var angle := TAU * float(point_index) / 24.0
		points.append(Vector2(cos(angle) * 215.0, sin(angle) * 50.0))
	return points


func _update_broken_neon(delta: float) -> void:
	if not neon_enabled or neon_subtitle == null or neon_subtitle_glow == null:
		return
	neon_flicker_time -= delta
	if neon_flicker_time > 0.0:
		return
	if neon_flicker_steps > 0:
		neon_flicker_steps -= 1
		_set_neon_lit(neon_flicker_steps % 2 == 0)
		neon_flicker_time = neon_random.randf_range(0.025, 0.075)
		return
	_set_neon_lit(true)
	if neon_random.randf() < 0.34:
		neon_flicker_steps = neon_random.randi_range(2, 5)
		neon_flicker_time = neon_random.randf_range(0.45, 1.5)
	else:
		neon_flicker_time = neon_random.randf_range(1.2, 3.2)


func _set_neon_lit(is_lit: bool) -> void:
	var intensity := 1.0 if is_lit else 0.08
	neon_subtitle.modulate = Color(1.0, 1.0, 1.0, intensity)
	neon_subtitle_glow.modulate = Color(1.0, 1.0, 1.0, intensity)


