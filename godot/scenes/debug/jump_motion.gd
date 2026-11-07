extends RefCounted
static var config: Dictionary = {}
var active := false
var elapsed := 0.0
var body_y := 0.0
var startup := 0.0
var velocity_y := 0.0
var gravity := 0.0
var horizontal_speed := 0.0
var flight_duration := 0.0
var ascent_duration := 0.0
var fall_duration := 0.0
var fall_gravity := 0.0
var total_duration := 0.0
var unused_delta := 0.0

func reset() -> void:
	active = false
	elapsed = 0.0
	body_y = 0.0
	unused_delta = 0.0

func begin(character_id: String, direction: float, running: bool, _animation_duration: float, startup_override: float = -1.0, _forward: bool = true) -> void:
	if config.is_empty():
		config = JSON.parse_string(FileAccess.get_file_as_string("res://data/jump-profiles.json"))
	var p: Dictionary = config.characters[character_id]
	var scale := float(config.referenceHeight)/float(config.legacyReferenceHeight)
	startup = startup_override if startup_override>=0.0 else float(config.startupSeconds)
	velocity_y = float(p.velocityY)*scale
	gravity = float(p.gravity)*scale
	horizontal_speed = signf(direction)*float(p.airSpeed)*scale*float(config.get("horizontalDistanceMultiplier",2.5))*(float(p.runMultiplier) if running else 1.0)
	horizontal_speed *= float(config.get("horizontalDistanceScale",0.8))
	ascent_duration = -velocity_y/gravity
	var fall_speed := float(config.get("descentSpeedMultiplier",1.0))
	fall_duration = ascent_duration/fall_speed
	fall_gravity = gravity*fall_speed*fall_speed
	flight_duration = ascent_duration+fall_duration
	total_duration = startup+flight_duration
	unused_delta = 0.0
	elapsed = 0.0
	body_y = 0.0
	active = true

func step(delta: float) -> float:
	if not active:
		return 0.0
	var previous := clampf(elapsed-startup,0.0,flight_duration)
	unused_delta = maxf(0.0,delta-(total_duration-elapsed))
	elapsed = minf(elapsed+delta,total_duration)
	var air_time := clampf(elapsed-startup,0.0,flight_duration)
	if air_time<=ascent_duration:
		body_y = velocity_y*air_time+0.5*gravity*air_time*air_time
	else:
		var apex_y := -velocity_y*velocity_y/(2.0*gravity)
		var falling_time := air_time-ascent_duration
		body_y = minf(0.0,apex_y+0.5*fall_gravity*falling_time*falling_time)
	if air_time>=flight_duration:
		body_y = 0.0
	if elapsed>=total_duration-0.000001:
		active = false
		body_y = 0.0
	var ascent_time := minf(air_time,ascent_duration)-minf(previous,ascent_duration)
	var falling_time := maxf(0.0,air_time-ascent_duration)-maxf(0.0,previous-ascent_duration)
	return horizontal_speed*(ascent_time+falling_time*float(config.get("horizontalFallSpeedScale",1.0)))
