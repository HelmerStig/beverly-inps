extends RefCounted
## Horizontal contact of the actual capsules, including their rounded ends.
## The Minkowski difference of two center segments is a parallelogram.
## Its radius-expanded intersection with y=0 gives the first contact distance.
var cached_key := ""
var cached_distance := 0.0

func separation(left: Node2D, right: Node2D) -> float:
	var key := "%s:%s:%s:%s:%d:%d:%s:%s" % [left.data.id,right.data.id,left.animation_id,right.animation_id,left.hurtbox_frame,right.hurtbox_frame,left.flipped,right.flipped]
	if key == cached_key:
		return cached_distance
	var result := 0.0
	for first: Dictionary in left.hurtboxes.current_parts:
		var a := _capsule(left,first.capsule)
		for second: Dictionary in right.hurtboxes.current_parts:
			var b := _capsule(right,second.capsule)
			var radius: float = a[2]+b[2]
			if minf(a[0].y,a[1].y)-a[2]>maxf(b[0].y,b[1].y)+b[2] or minf(b[0].y,b[1].y)-b[2]>maxf(a[0].y,a[1].y)+a[2]:
				continue
			var points: Array[Vector2] = [a[0]-b[0],a[0]-b[1],a[1]-b[0],a[1]-b[1]]
			for i in range(4):
				for j in range(i+1,4):
					result = maxf(result,_boundary(points[i],points[j],radius))
	cached_key = key
	cached_distance = result + 0.5
	return cached_distance

func _capsule(fighter: Node2D, box: Array) -> Array:
	var scale: Vector2 = fighter.hurtboxes.scale
	return [(Vector2(box[0],box[1])-fighter.hurtboxes.anchor)*scale,(Vector2(box[2],box[3])-fighter.hurtboxes.anchor)*scale,float(box[4])*absf(scale.y)]

func _boundary(a: Vector2, b: Vector2, radius: float) -> float:
	var delta := b-a
	if absf(delta.y)<0.00001:
		if absf(a.y)>radius:
			return -INF
		return maxf(a.x,b.x)+sqrt(maxf(0.0,radius*radius-a.y*a.y))
	var low := maxf(0.0,minf((-radius-a.y)/delta.y,(radius-a.y)/delta.y))
	var high := minf(1.0,maxf((-radius-a.y)/delta.y,(radius-a.y)/delta.y))
	if low>high:
		return -INF
	var peak_y := radius*delta.x*signf(delta.y)/delta.length()
	var t := clampf((peak_y-a.y)/delta.y,low,high)
	var point := a+delta*t
	return point.x+sqrt(maxf(0.0,radius*radius-point.y*point.y))

func constrain(previous: Vector2, desired: Vector2, first: Node2D, second: Node2D) -> Vector2:
	var direction := 1.0 if previous.x<=previous.y else -1.0
	var distance := separation(first,second) if direction>0 else separation(second,first)
	var old_gap := absf(previous.y-previous.x)
	# Animation/character changes may already overlap: never lock retreat.
	var closing := (desired.x-previous.x)*direction+(previous.y-desired.y)*direction
	var allowed := maxf(0.0,old_gap-distance)
	if closing<=allowed:
		return desired
	var inward1 := maxf(0.0,(desired.x-previous.x)*direction)
	var inward2 := maxf(0.0,(previous.y-desired.y)*direction)
	var total := inward1+inward2
	if total<=0.0:
		return desired
	var excess := closing-allowed
	return Vector2(desired.x-direction*excess*inward1/total,desired.y+direction*excess*inward2/total)
