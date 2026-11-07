extends RefCounted
const TAP_WINDOW := 0.25
const WALK_SPEED := 420.0
const BACK_SPEED := 320.0
const RUN_SPEED := 840.0
const HOP_SPEED := 630.0
var state := "idle"
var time := 0.0
var previous_direction := 0
var previous_facing := 0
var last_forward := -10.0
var last_back := -10.0
var hop_elapsed := 0.0
var hop_direction := 0.0

func reset() -> void:
	state = "idle"
	previous_direction = 0
	previous_facing = 0
	last_forward = -10.0
	last_back = -10.0
	hop_elapsed = 0.0

func step(axis: float, flipped: bool, delta: float, hop_duration: float) -> float:
	time += delta
	var facing := -1 if flipped else 1
	var direction := int(signf(axis)) if absf(axis)>=0.5 else 0
	var tapped := direction!=0 and direction!=previous_direction
	previous_direction = direction
	if state=="back-jump":
		var amount := minf(delta,maxf(0.0,hop_duration-hop_elapsed))
		hop_elapsed += amount
		if hop_elapsed>=hop_duration-0.000001:
			state = "idle"
		return hop_direction*HOP_SPEED*amount
	if previous_facing!=facing:
		last_forward = -10.0
		last_back = -10.0
		state = "idle"
	previous_facing = facing
	if state=="run" and direction!=facing:
		last_forward = -10.0
	if tapped:
		if direction==facing:
			if time-last_forward<=TAP_WINDOW:
				state = "run"
			last_forward = time
			last_back = -10.0
		else:
			if time-last_back<=TAP_WINDOW:
				state = "back-jump"
				hop_elapsed = 0.0
				hop_direction = -facing
				last_back = -10.0
				last_forward = -10.0
				return step(axis,flipped,0.0,hop_duration)
			last_back = time
			last_forward = -10.0
	if direction==0:
		state = "idle"
	elif direction!=facing:
		state = "backwalk"
	elif state!="run":
		state = "walk"
	var speed := RUN_SPEED if state=="run" else BACK_SPEED if state=="backwalk" else WALK_SPEED
	return direction*speed*delta
