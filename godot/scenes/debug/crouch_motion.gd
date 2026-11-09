extends RefCounted
## Complete each transition; a short tap still plays the full down/up sequence.
var state := ""
var phase := 0.0
var clock := 0.0
var unused_delta := 0.0

func reset() -> void:
	state = ""
	phase = 0.0
	clock = 0.0
	unused_delta = 0.0

func is_active() -> bool:
	return not state.is_empty()

func step(held: bool, delta: float, duration: float) -> void:
	unused_delta = 0.0
	if state.is_empty():
		if not held:
			unused_delta = delta
			return
		state = "lowering"
		phase = 0.0
	var remaining := delta
	for transition in range(4):
		if state=="holding":
			clock = duration
			if held:
				return
			state = "rising"
			phase = 0.0
		var consumed := minf(remaining,maxf(0.0,duration-phase))
		phase += consumed
		remaining -= consumed
		clock = phase if state=="lowering" else maxf(0.0,duration-phase-0.000001)
		if phase<duration-0.0000001:
			return
		if state=="lowering":
			state = "holding"
			phase = 0.0
			clock = duration
		else:
			reset()
			unused_delta = remaining
			return
