extends Control
## In-game editor: source-cell coordinates stay independent of scale and facing.
var screen: Control
var active := false
var slot := 0
var playing := false
var selected := -1
var dirty := false
var updating := false
var drag_mode := -1
var drag_start := Vector2.ZERO
var drag_capsule: Array = []
var history: Array = []
var panel: PanelContainer
var animations: OptionButton
var frame: SpinBox
var parts: ItemList
var values: Array[SpinBox] = []
var message: Label
var play_button: Button

func setup(owner_screen: Control) -> void:
	screen = owner_screen
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	size = Vector2(1920,1080)
	panel = PanelContainer.new()
	panel.position = Vector2(1380,235)
	panel.custom_minimum_size = Vector2(510,600)
	var theme := Theme.new()
	theme.default_font = preload("res://assets/fonts/Oswald-Variable.ttf")
	theme.default_font_size = 23
	panel.theme = theme
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.025,0.035,0.065,0.97)
	style.set_content_margin_all(12)
	style.set_corner_radius_all(8)
	panel.add_theme_stylebox_override("panel",style)
	add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)
	var title := Label.new()
	title.text = "EDITOR HURTBOX · F4 chiudi"
	column.add_child(title)
	var players := OptionButton.new()
	players.add_item("Player 1")
	players.add_item("Player 2")
	column.add_child(players)
	players.item_selected.connect(func(index: int):
		slot = index
		_refresh_animations()
	)
	animations = OptionButton.new()
	column.add_child(animations)
	animations.item_selected.connect(func(_index: int):
		fighter().set_animation(animations.get_item_text(animations.selected),true)
		_refresh_frame()
	)
	var row := HBoxContainer.new()
	column.add_child(row)
	_button(row,"<",func(): show_frame(fighter().frame_index-1))
	frame = SpinBox.new()
	frame.min_value = 1
	frame.step = 1
	row.add_child(frame)
	frame.value_changed.connect(func(value: float):
		if not updating: show_frame(int(value)-1)
	)
	_button(row,">",func(): show_frame(fighter().frame_index+1))
	play_button = _button(row,"Riproduci",func():
		playing = not playing
		play_button.text = "Pausa" if playing else "Riproduci"
	)
	parts = ItemList.new()
	parts.custom_minimum_size = Vector2(480,180)
	column.add_child(parts)
	parts.item_selected.connect(func(index: int):
		selected = index
		_refresh_values()
	)
	var labels := ["A x","A y","B x","B y","Raggio"]
	for i in range(5):
		var line := HBoxContainer.new()
		column.add_child(line)
		var label := Label.new()
		label.text = labels[i]
		label.custom_minimum_size.x = 100
		line.add_child(label)
		var spin := SpinBox.new()
		spin.min_value = 1 if i==4 else -1024
		spin.max_value = 2048
		spin.step = 0.5
		spin.custom_minimum_size.x = 180
		line.add_child(spin)
		values.append(spin)
		spin.value_changed.connect(func(value: float):
			if updating or selected<0: return
			remember()
			var edited: Array = rig().current_parts.duplicate(true)
			edited[selected].capsule[i] = value
			apply_parts(edited)
		)
	row = HBoxContainer.new()
	column.add_child(row)
	_button(row,"Aggiungi",add_capsule)
	_button(row,"Elimina",delete_capsule)
	_button(row,"Annulla",undo)
	row = HBoxContainer.new()
	column.add_child(row)
	_button(row,"Salva",save)
	_button(row,"Ripristina frame",restore_frame)
	message = Label.new()
	message.text = "Trascina forma o estremi. Raggio: campo numerico."
	message.add_theme_font_size_override("font_size",17)
	column.add_child(message)
	visible = false

func _button(parent: Node, text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func fighter() -> Node2D:
	return screen.fighters[slot]

func rig() -> Area2D:
	return fighter().hurtboxes

func toggle() -> void:
	active = not active
	visible = active
	playing = false
	play_button.text = "Riproduci"
	for actor in screen.fighters:
		actor.reset_motion()
		actor.frozen = active
	if active:
		screen.set_hurtboxes_visible(true)
		_refresh_animations()
	else:
		for actor in screen.fighters: actor.visible = true
		screen.contact.cached_key = ""
		screen._update_view()

func _refresh_animations() -> void:
	animations.clear()
	for id in fighter().data.animations:
		animations.add_item(id)
	fighter().set_animation("idle",true)
	_refresh_frame()

func _refresh_frame() -> void:
	selected = -1
	history.clear()
	updating = true
	frame.max_value = fighter().animation.frames.size()
	frame.value = fighter().frame_index+1
	updating = false
	_refresh_list()

func show_frame(index: int) -> void:
	playing = false
	play_button.text = "Riproduci"
	var actor := fighter()
	index = clampi(index,0,actor.animation.frames.size()-1)
	actor.elapsed = 0.000001
	for i in range(index):
		actor.elapsed += float(actor.animation.frameDurations[i])/1000.0 if actor.animation.has("frameDurations") else 1.0/float(actor.animation.playbackFps)
	actor._update_frame()
	_refresh_frame()

func _refresh_list() -> void:
	parts.clear()
	for part: Dictionary in rig().current_parts:
		parts.add_item(str(part.id))
	selected = mini(selected,parts.item_count-1)
	if selected>=0: parts.select(selected)
	_refresh_values()

func _refresh_values() -> void:
	updating = true
	for i in range(5):
		values[i].editable = selected>=0
		if selected>=0: values[i].value = rig().current_parts[selected].capsule[i]
	updating = false
	queue_redraw()

func remember() -> void:
	history.append(rig().current_parts.duplicate(true))
	if history.size()>100: history.pop_front()

func apply_parts(edited: Array) -> void:
	rig().edit_parts(edited)
	dirty = true
	message.text = "Modifiche non salvate · Salva per mantenerle"
	screen.contact.cached_key = ""
	_refresh_list()

func add_capsule() -> void:
	remember()
	var edited: Array = rig().current_parts.duplicate(true)
	var center: Vector2 = rig().anchor-Vector2(0,100)
	edited.append({"id":"manual_"+str(Time.get_ticks_usec()),"capsule":[center.x,center.y-20,center.x,center.y+20,15.0]})
	selected = edited.size()-1
	apply_parts(edited)

func delete_capsule() -> void:
	if selected<0: return
	remember()
	var edited: Array = rig().current_parts.duplicate(true)
	edited.remove_at(selected)
	apply_parts(edited)

func undo() -> void:
	if not history.is_empty(): apply_parts(history.pop_back())

func restore_frame() -> void:
	remember()
	rig().overrides.erase(rig().frame_key(rig().current_frame))
	rig().update_frame(rig().current_frame)
	dirty = true
	message.text = "Frame originale ripristinato · Salva per confermare"
	screen.contact.cached_key = ""
	_refresh_list()

func save() -> void:
	var result: Error = rig().save_overrides()
	if result==OK:
		dirty = false
		message.text = "Salvato: godot/data/manual-hurtboxes.json"
	else:
		message.text = "Salvataggio fallito: "+error_string(result)

func _process(delta: float) -> void:
	if not active: return
	for index in range(screen.fighters.size()):
		screen.fighters[index].visible = index==slot
	fighter().position = Vector2(850,1025)
	if playing:
		fighter().elapsed += delta
		fighter()._update_frame()
		updating = true
		frame.value = fighter().frame_index+1
		updating = false
		selected = -1
		history.clear()
		_refresh_list()
	queue_redraw()

func source_point(point: Vector2) -> Vector2:
	return rig().to_local(point)+rig().anchor

func _input(event: InputEvent) -> void:
	if not active or playing: return
	var point := get_viewport().get_mouse_position()
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:
		if not event.pressed:
			drag_mode = -1
			return
		if panel.get_global_rect().has_point(point): return
		var p := source_point(point)
		drag_mode = -1
		if selected>=0:
			var cap: Array = rig().current_parts[selected].capsule
			if p.distance_to(Vector2(cap[0],cap[1]))<10: drag_mode = 0
			elif p.distance_to(Vector2(cap[2],cap[3]))<10: drag_mode = 1
		if drag_mode<0:
			var best := INF
			for i in range(rig().current_parts.size()):
				var cap: Array = rig().current_parts[i].capsule
				var distance := p.distance_to(Geometry2D.get_closest_point_to_segment(p,Vector2(cap[0],cap[1]),Vector2(cap[2],cap[3])))
				if distance<=float(cap[4])+5 and distance<best:
					selected = i
					best = distance
					drag_mode = 2
		if drag_mode>=0:
			remember()
			drag_start = p
			drag_capsule = rig().current_parts[selected].capsule.duplicate()
			_refresh_list()
			get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and drag_mode>=0:
		var delta := source_point(point)-drag_start
		var edited: Array = rig().current_parts.duplicate(true)
		var cap: Array = drag_capsule.duplicate()
		for end in range(2):
			if drag_mode==2 or drag_mode==end:
				cap[end*2] += delta.x
				cap[end*2+1] += delta.y
		edited[selected].capsule = cap
		apply_parts(edited)
		get_viewport().set_input_as_handled()

func _draw() -> void:
	if not active or selected<0: return
	var cap: Array = rig().current_parts[selected].capsule
	var a: Vector2 = rig().to_global(Vector2(cap[0],cap[1])-rig().anchor)
	var b: Vector2 = rig().to_global(Vector2(cap[2],cap[3])-rig().anchor)
	draw_line(a,b,Color.WHITE,3)
	draw_circle(a,7,Color.WHITE)
	draw_circle(b,7,Color.WHITE)
