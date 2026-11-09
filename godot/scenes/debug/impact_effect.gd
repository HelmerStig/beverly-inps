extends Node2D
## Pixel geometry rendered inside the scene viewport, before the CRT pipeline.
var blocked := false
var direction := 1.0
var age := 0.0
var duration := 0.14

func setup(point: Vector2, is_blocked: bool, facing: float) -> void:
	position = point.snapped(Vector2(2,2))
	blocked = is_blocked
	direction = facing
	duration = 0.18 if blocked else 0.28
	z_index = 20

func _process(delta: float) -> void:
	age += delta
	if age >= duration:
		queue_free()
	else:
		queue_redraw()

func pixel(point: Vector2) -> Vector2:
	return Vector2(point.x*direction,point.y).snapped(Vector2(2,2))

func _draw() -> void:
	var t := clampf(age/(0.18 if blocked else 0.14),0,1)
	var fade := clampf((1.0-t)*3.0,0,1)
	if blocked:
		var arc := PackedVector2Array()
		for i in range(13):
			var angle := -PI*.45+i*PI*.9/12
			arc.append(pixel(Vector2(cos(angle)*(16+t*12)-12,sin(angle)*(29+t*10))))
		draw_polyline(arc,Color(0.12,0.40,0.90,fade*.65),10,false)
		draw_polyline(arc,Color(0.40,0.82,1.0,fade),6,false)
		draw_polyline(arc,Color(0.90,0.98,1.0,fade),2,false)
	else:
		var burst := PackedVector2Array()
		for i in range(16):
			var angle := i*TAU/16
			var radius := (30.0 if i%2==0 else 9.0)*(0.7+t*.75)
			burst.append(pixel(Vector2.from_angle(angle)*radius))
		draw_colored_polygon(burst,Color(1.0,.38,.08,fade))
		var core := PackedVector2Array()
		for i in range(16):core.append(burst[i]*.60)
		draw_colored_polygon(core,Color(1.0,.87,.36,fade))
		draw_rect(Rect2(Vector2(-5,-5),Vector2(10,10)),Color(1.0,1.0,.93,fade))
	for i in range(6):
		var angle := -PI*.7+i*PI*1.4/5
		var speed := 30+i%3*12
		var point := pixel(Vector2.from_angle(angle)*(10+t*speed))
		var color := Color(.48,.85,1.0,fade) if blocked else Color(1.0,.65,.18,fade)
		draw_rect(Rect2(point,Vector2(4 if i%2==0 else 2,2)),color)
	if not blocked:
		_draw_hit_sparks()

func _draw_hit_sparks() -> void:
	for i in range(10):
		var life := 0.18 + (i%4)*0.03
		var time := age-(i%3)*0.006
		if time<0 or time>=life:
			continue
		var angle := -PI*.90+i*PI*1.8/9.0
		var velocity := Vector2.from_angle(angle)*(180.0+(i%4)*55.0)
		var gravity := Vector2(0,460)
		var head := pixel(velocity*time+gravity*time*time*.5)
		var previous := maxf(0,time-0.022)
		var tail := pixel(velocity*previous+gravity*previous*previous*.5)
		var alpha := clampf((1.0-time/life)*2.0,0,1)
		draw_line(tail,head,Color(1.0,.37,.06,alpha*.7),4,false)
		draw_line(tail,head,Color(1.0,.78,.20,alpha),2,false)
		draw_rect(Rect2(head-Vector2(1,1),Vector2(2,2)),Color(1.0,.98,.75,alpha))
