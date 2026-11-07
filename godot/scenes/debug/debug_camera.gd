extends RefCounted
## Edge-follow camera: both anchors must remain inside the visible safe area.
const WORLD_WIDTH := 2550.0
const VIEW_WIDTH := 1920.0
const MARGIN := 180.0
const MAX_SEPARATION := VIEW_WIDTH - MARGIN * 2.0
const WORLD_MARGIN := MARGIN

static func constrain_pair(previous: Vector2, desired: Vector2) -> Vector2:
	var result := Vector2(clampf(desired.x, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN), clampf(desired.y, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN))
	var direction := signf(result.y - result.x)
	var excess := absf(result.y - result.x) - MAX_SEPARATION
	if excess > 0.0:
		var outward1 := maxf(0.0, (previous.x - result.x) * direction)
		var outward2 := maxf(0.0, (result.y - previous.y) * direction)
		var total := outward1 + outward2
		if total > 0.0:
			result.x += direction * excess * outward1 / total
			result.y -= direction * excess * outward2 / total
	return result

static func follow(current: float, positions: Vector2) -> float:
	var minimum := clampf(maxf(positions.x, positions.y) - VIEW_WIDTH + MARGIN,0.0,WORLD_WIDTH-VIEW_WIDTH)
	var maximum := clampf(minf(positions.x, positions.y) - MARGIN,0.0,WORLD_WIDTH-VIEW_WIDTH)
	return clampf(current, minimum, maximum)
