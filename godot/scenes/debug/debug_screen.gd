extends Control

const BACKGROUND := preload("res://scenes/title/title_background.gd")
const PIPELINE := preload("res://scenes/title/crt_pipeline.gd")
const FIGHTER := preload("res://scenes/debug/debug_fighter.gd")
const CAMERA := preload("res://scenes/debug/debug_camera.gd")
const CONTACT := preload("res://scenes/debug/hurtbox_contact.gd")
const FONT := preload("res://assets/fonts/Oswald-Variable.ttf")
const STAGE := "res://assets/stages/Piazza Europa/stage.json"
var roster: Array = []
var fighters: Array[Node2D] = []
var selectors: Array[OptionButton] = []
var readouts: Array[Label] = []
var source_viewport: SubViewport
var background: Node2D
var pipeline: Node
var display: TextureRect
var status: Label
var camera_x := 315.0
var movement_enabled := true
var returning := false
var hurtboxes_visible := false
var contact := CONTACT.new()
var hurtbox_editor: Control
var impact_effects: Node2D

func _ready() -> void:
	roster = JSON.parse_string(FileAccess.get_file_as_string("res://data/debug-roster.json")).characters
	var container := SubViewportContainer.new()
	container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	container.stretch = true
	add_child(container)
	source_viewport = SubViewport.new()
	source_viewport.size = Vector2i(1920,1080)
	source_viewport.disable_3d = true
	source_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	container.add_child(source_viewport)
	background = BACKGROUND.new()
	background.manifest_path = STAGE
	background.camera_x = camera_x
	source_viewport.add_child(background)
	impact_effects = Node2D.new()
	impact_effects.name = "ImpactEffects"
	source_viewport.add_child(impact_effects)
	for slot in range(2):
		var fighter := FIGHTER.new()
		source_viewport.add_child(fighter)
		fighters.append(fighter)
		fighter.world_x = 675.0 if slot == 0 else 1890.0
		fighter.flipped = slot == 1
		fighter.select_character(roster[0 if slot == 0 else 4])
		fighter.light_punch_contact.connect(_show_impact)
	_build_toolbar()
	hurtbox_editor = preload("res://scenes/debug/hurtbox_editor.gd").new()
	source_viewport.add_child(hurtbox_editor)
	hurtbox_editor.setup(self)
	pipeline = PIPELINE.new()
	add_child(pipeline)
	pipeline.build(source_viewport.get_texture(), "res://assets/stages/Piazza Europa/crt-preset.json")
	display = TextureRect.new()
	display.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	display.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	display.texture = pipeline.output
	display.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(display)
	_update_view()

func _build_toolbar() -> void:
	var ui := Control.new()
	ui.size = Vector2(1920,1080)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme := Theme.new()
	theme.default_font = FONT
	theme.default_font_size = 25
	ui.theme = theme
	source_viewport.add_child(ui)
	var panel := PanelContainer.new()
	panel.position = Vector2(24,24)
	panel.size = Vector2(1872,106)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.025,0.035,0.065,0.94)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(14)
	panel.add_theme_stylebox_override("panel",style)
	ui.add_child(panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation",24)
	panel.add_child(row)
	var heading := Label.new()
	heading.text = "DEBUG · Piazza Europa"
	heading.custom_minimum_size.x = 300
	row.add_child(heading)
	for slot in range(2):
		var column := VBoxContainer.new()
		column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(column)
		var selector := OptionButton.new()
		selector.custom_minimum_size.x = 280
		for character: Dictionary in roster:
			selector.add_item("P%d · %s" % [slot+1, character.name])
		selector.select(0 if slot == 0 else 4)
		selector.item_selected.connect(func(index: int):
			select_character(slot,index)
			selector.release_focus()
		)
		var selection_row := HBoxContainer.new()
		column.add_child(selection_row)
		selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if slot == 0:
			selection_row.add_child(_selection_arrow("←",slot,-1))
		selection_row.add_child(selector)
		if slot == 0:
			selection_row.add_child(_selection_arrow("→",slot,1))
		else:
			var arrows := VBoxContainer.new()
			arrows.add_theme_constant_override("separation",0)
			selection_row.add_child(arrows)
			arrows.add_child(_selection_arrow("↑",slot,-1))
			arrows.add_child(_selection_arrow("↓",slot,1))
		selectors.append(selector)
		var info := Label.new()
		info.add_theme_font_size_override("font_size",20)
		column.add_child(info)
		readouts.append(info)
	var reset := Button.new()
	var edit := Button.new()
	edit.text = "Hurtbox · F4"
	edit.focus_mode = Control.FOCUS_NONE
	edit.pressed.connect(func(): hurtbox_editor.toggle())
	row.add_child(edit)
	reset.text = "Centra / Reset"
	reset.pressed.connect(func():
		reset_positions()
		reset.release_focus()
	)
	row.add_child(reset)
	var back := Button.new()
	back.text = "Indietro · Esc"
	back.pressed.connect(_return_to_title)
	row.add_child(back)
	status = Label.new()
	status.position = Vector2(30,220)
	status.add_theme_color_override("font_shadow_color",Color.BLACK)
	status.add_theme_constant_override("shadow_outline_size",5)
	status.add_theme_font_size_override("font_size",22)
	ui.add_child(status)
	var help := Label.new()
	help.text = "P1 A/D · salto W/Spazio · pugno F | P2 J/L · salto I · pugno O | Joypad: su salto · X pugno | Scelta P1 ←/→ P2 ↑/↓ | F3 box · Esc titolo · F8 CRT · F11 fullscreen"
	help.add_theme_font_size_override("font_size",21)
	help.position = Vector2(30,1037)
	help.add_theme_color_override("font_shadow_color",Color.BLACK)
	help.add_theme_constant_override("shadow_outline_size",5)
	ui.add_child(help)
	var shortcuts := Label.new()
	shortcuts.text = "Dummy P2: G guardia on/off | C accovacciato on/off | G+C guardia bassa | Basso: P1 S / P2 K / stick o D-pad | Medio: P1 R / P2 P / Joy Y | Forte: P1 T / P2 U / Joy RB | Calcio: P1 V / P2 M / Joy A"
	shortcuts.position = Vector2(30,185)
	shortcuts.add_theme_font_size_override("font_size",21)
	shortcuts.add_theme_color_override("font_shadow_color",Color.BLACK)
	shortcuts.add_theme_constant_override("shadow_outline_size",5)
	ui.add_child(shortcuts)

func _selection_arrow(text: String, slot: int, direction: int) -> Button:
	var button := Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size.x = 44
	button.pressed.connect(cycle_character.bind(slot,direction))
	return button

func cycle_character(slot: int, direction: int) -> void:
	select_character(slot,posmod(selectors[slot].selected+direction,roster.size()))
	selectors[slot].release_focus()

func select_character(slot: int, index: int) -> void:
	fighters[slot].select_character(roster[index])
	selectors[slot].select(index)
	if hurtbox_editor!=null and hurtbox_editor.active:
		hurtbox_editor._refresh_animations()
	_update_view()

func reset_positions() -> void:
	for effect in impact_effects.get_children():
		effect.queue_free()
	for fighter in fighters:
		fighter.reset_motion()
	fighters[0].world_x = 675.0
	fighters[1].world_x = 1890.0
	camera_x = 315.0
	if hurtbox_editor!=null and hurtbox_editor.active:
		hurtbox_editor._refresh_animations()
	_update_view()

func _physics_process(delta: float) -> void:
	if hurtbox_editor!=null and hurtbox_editor.active:
		return
	if not movement_enabled or fighters.is_empty():
		return
	var focused := source_viewport.gui_get_focus_owner()
	if focused != null:
		for slot in range(fighters.size()):
			var fighter := fighters[slot]
			fighter.reset_motion()
			fighter.jump_was_down = _jump_held(slot)
			fighter.attack_was_down = _attack_held(slot)
			fighter.medium_was_down = _medium_held(slot)
			fighter.heavy_was_down = _heavy_held(slot)
			fighter.kick_was_down = _kick_held(slot)
		_update_view()
		return
	move_pair(Vector2(fighters[0].locomotion_step(_axis(0),delta,_jump_held(0),_attack_held(0),_crouch_held(0),_medium_held(0),_heavy_held(0),_kick_held(0)),fighters[1].locomotion_step(_axis(1),delta,_jump_held(1),_attack_held(1),_crouch_held(1),_medium_held(1),_heavy_held(1),_kick_held(1))))
	fighters[0].resolve_light_punch(fighters[1])
	fighters[1].resolve_light_punch(fighters[0])
	_update_fighter_depth()

func _kick_held(slot: int) -> bool:
	var keyboard := Input.is_physical_key_pressed(KEY_V if slot==0 else KEY_M)
	var pads := Input.get_connected_joypads()
	return keyboard or (slot<pads.size() and Input.is_joy_button_pressed(pads[slot],JOY_BUTTON_A))

func _heavy_held(slot: int) -> bool:
	var keyboard := Input.is_physical_key_pressed(KEY_T if slot==0 else KEY_U)
	var pads := Input.get_connected_joypads()
	return keyboard or (slot<pads.size() and Input.is_joy_button_pressed(pads[slot],JOY_BUTTON_RIGHT_SHOULDER))

func _medium_held(slot: int) -> bool:
	var keyboard := Input.is_physical_key_pressed(KEY_R if slot==0 else KEY_P)
	var pads := Input.get_connected_joypads()
	return keyboard or (slot<pads.size() and Input.is_joy_button_pressed(pads[slot],JOY_BUTTON_Y))

func _attack_held(slot: int) -> bool:
	var keyboard := Input.is_physical_key_pressed(KEY_F if slot==0 else KEY_O)
	var pads := Input.get_connected_joypads()
	return keyboard or (slot<pads.size() and Input.is_joy_button_pressed(pads[slot],JOY_BUTTON_X))

func _crouch_held(slot: int) -> bool:
	var keyboard := Input.is_physical_key_pressed(KEY_S if slot==0 else KEY_K)
	var pads := Input.get_connected_joypads()
	if slot<pads.size():
		return keyboard or Input.is_joy_button_pressed(pads[slot],JOY_BUTTON_DPAD_DOWN) or Input.get_joy_axis(pads[slot],JOY_AXIS_LEFT_Y)>0.5
	return keyboard

func _jump_held(slot: int) -> bool:
	var keyboard := (Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_SPACE)) if slot==0 else Input.is_physical_key_pressed(KEY_I)
	var pads := Input.get_connected_joypads()
	if slot<pads.size():
		return keyboard or Input.is_joy_button_pressed(pads[slot],JOY_BUTTON_DPAD_UP) or Input.get_joy_axis(pads[slot],JOY_AXIS_LEFT_Y)<-0.5
	return keyboard

func _axis(slot: int) -> float:
	var left := KEY_A if slot == 0 else KEY_J
	var right := KEY_D if slot == 0 else KEY_L
	var keyboard := float(Input.is_physical_key_pressed(right)) - float(Input.is_physical_key_pressed(left))
	var pads := Input.get_connected_joypads()
	var joy := 0.0
	if slot < pads.size():
		var device := pads[slot]
		joy = Input.get_joy_axis(device,JOY_AXIS_LEFT_X)
		joy = signf(joy) * (absf(joy)-0.25)/0.75 if absf(joy)>0.25 else 0.0
		var dpad := float(Input.is_joy_button_pressed(device,JOY_BUTTON_DPAD_RIGHT)) - float(Input.is_joy_button_pressed(device,JOY_BUTTON_DPAD_LEFT))
		if dpad != 0.0:
			joy = dpad
	return clampf(keyboard+joy,-1,1)

func move_pair(displacement: Vector2) -> void:
	var previous := Vector2(fighters[0].world_x,fighters[1].world_x)
	var result := CAMERA.constrain_pair(previous,previous+displacement)
	result = contact.constrain(previous,result,fighters[0],fighters[1])
	fighters[0].world_x = result.x
	fighters[1].world_x = result.y
	camera_x = CAMERA.follow(camera_x,result)
	_update_view()

func _update_view() -> void:
	_update_fighter_depth()
	background.camera_x = camera_x
	impact_effects.position.x = -camera_x
	for slot in range(fighters.size()):
		var fighter := fighters[slot]
		fighter.position = Vector2(fighter.world_x-camera_x,1025+fighter.body_y)
		if not fighter.jump.active and not fighter.attack_active and fighter.reaction_kind.is_empty():
			var desired_facing: bool = fighter.world_x > fighters[1-slot].world_x
			if fighter.flipped!=desired_facing:
				fighter.flipped = desired_facing
				fighter._update_frame()
		var animation: Dictionary = fighter.animation
		readouts[slot].text = "%d cm · %s · x %d · Colpi %d" % [fighter.data.heightCm,animation.name,fighter.world_x,fighter.confirmed_hits]
	status.text = "Camera: %d / 630 · 2× avanti: corsa · 2× indietro: salto · F3: hurtbox %s (posa corrente)" % [camera_x,"visibili" if hurtboxes_visible else "nascoste"]

func _update_fighter_depth() -> void:
	for fighter in fighters:
		fighter.z_index = 10 if fighter.attack_active else 1

func _show_impact(point: Vector2, blocked: bool, direction: float) -> void:
	_update_fighter_depth()
	var effect := preload("res://scenes/debug/impact_effect.gd").new()
	effect.setup(point+Vector2(camera_x,0),blocked,direction)
	impact_effects.add_child(effect)

func set_hurtboxes_visible(value: bool) -> void:
	hurtboxes_visible = value
	for fighter in fighters:
		fighter.hurtboxes.debug_visible = value
		fighter.hurtboxes.queue_redraw()
		fighter.hitbox.debug_visible = value
		fighter.hitbox.queue_redraw()
	_update_view()

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.keycode == KEY_F4:
		hurtbox_editor.toggle()
		get_viewport().set_input_as_handled()
		return
	if hurtbox_editor.active:
		if event.keycode == KEY_F3:
			set_hurtboxes_visible(not hurtboxes_visible)
			get_viewport().set_input_as_handled()
		if event.keycode == KEY_ESCAPE:
			hurtbox_editor.toggle()
			get_viewport().set_input_as_handled()
		return
	if event.keycode == KEY_F3:
		set_hurtboxes_visible(not hurtboxes_visible)
		get_viewport().set_input_as_handled()
		return
	for selector in selectors:
		if selector.get_popup().visible:
			return
	match event.keycode:
		KEY_G:
			fighters[1].set_training_stance(not fighters[1].training_guard,fighters[1].training_crouch)
			_update_view()
		KEY_C:
			fighters[1].set_training_stance(fighters[1].training_guard,not fighters[1].training_crouch)
			_update_view()
		KEY_LEFT:
			cycle_character(0,-1)
		KEY_RIGHT:
			cycle_character(0,1)
		KEY_UP:
			cycle_character(1,-1)
		KEY_DOWN:
			cycle_character(1,1)
		_:
			return
	get_viewport().set_input_as_handled()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		_return_to_title()
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F8:
			pipeline.set_enabled(not pipeline.enabled)
			background.effects_enabled = pipeline.enabled
			for fighter in fighters:
				fighter.effects_enabled = pipeline.enabled
			display.texture = pipeline.output if pipeline.enabled else pipeline.source
		elif event.keycode == KEY_F11:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)

func _return_to_title() -> void:
	if returning:
		return
	returning = true
	get_tree().change_scene_to_file("res://scenes/title/title_screen.tscn")
