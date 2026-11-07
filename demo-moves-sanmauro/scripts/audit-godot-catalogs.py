"""Esegue copie isolate dei cataloghi in Godot, senza scrivere nel progetto sorgente.
I PNG sono letti come ImageTexture da percorsi assoluti; nessuna importazione Godot
nel vecchio progetto. L'output descrive rettangoli e durate runtime effettivi.
"""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import os
import shutil

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('F:/Personali/Godot')
WORK=ROOT.parent/'tmp/godot-animation-audit'
WORK.mkdir(parents=True,exist_ok=True)


def evaluate(expression, values):
    def visit(node):
        if isinstance(node,ast.Constant): return node.value
        if isinstance(node,ast.Name):
            if node.id in ('true','false','null'): return {'true':True,'false':False,'null':None}[node.id]
            return values[node.id]
        if isinstance(node,(ast.List,ast.Tuple)): return [visit(n) for n in node.elts]
        if isinstance(node,ast.UnaryOp) and isinstance(node.op,ast.USub): return -visit(node.operand)
        if isinstance(node,ast.BinOp):
            a,b=visit(node.left),visit(node.right)
            return {ast.Add:lambda:a+b,ast.Sub:lambda:a-b,ast.Mult:lambda:a*b,ast.Div:lambda:a/b}[type(node.op)]()
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
            args=[visit(n) for n in node.args]
            if node.func.id=='Vector2': return dict(vector=args)
            if node.func.id in ('PackedInt32Array','PackedFloat32Array'): return args[0]
            if node.func.id=='preload' and args[0].endswith('.png'): return dict(texture=args[0].removeprefix('res://'))
        raise ValueError(expression)
    return visit(ast.parse(expression.strip(),mode='eval').body)


for who in ['Arianna','Mangler']:
    code=(SOURCE/'scripts'/(who+'.gd')).read_text(encoding='utf-8-sig')
    values={}
    for match in re.finditer(r'^const (\w+)(?:\s*:\s*\w+)?\s*(?::=|=)\s*',code,re.M):
        tail=code[match.end():];lines=[];balance=0
        for line in tail.splitlines():
            line=line.split('#')[0];lines.append(line)
            balance+=sum(line.count(ch) for ch in '([')-sum(line.count(ch) for ch in ')]')
            if balance<=0: break
        try: values[match[1]]=evaluate('\n'.join(lines),values)
        except (ValueError,KeyError,SyntaxError,TypeError): pass
    catalog=(SOURCE/'scripts'/(who+'AnimationCatalog.gd')).read_text(encoding='utf-8-sig')
    functions=re.findall(r'^\t(configure_\w+)\(\)',re.search(r'func configure_all\(\).*?(?=\nfunc |\Z)',catalog,re.S)[0],re.M)
    functions=[f for f in functions if not any(s in f for s in ['special','super','grab','combo'])]
    catalog=re.sub(r'^class_name .*\n','',catalog,flags=re.M)
    catalog=re.sub(r'preload\("res://([^"\n]+\.png)"\)',r'fighter.get_texture("\1")',catalog)
    catalog=catalog.replace('var sheet := fighter.get_texture(', 'var sheet: Texture2D = fighter.get_texture(')
    (WORK/(who+'Catalog.gd')).write_text(catalog,encoding='utf-8')
    (WORK/(who+'.json')).write_text(json.dumps(dict(values=values,functions=functions,source=str(SOURCE).replace('\\','/'))),encoding='utf-8')

(WORK/'project.godot').write_text('config_version=5\n[application]\nconfig/name="Offline animation audit"\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n',encoding='utf-8')
(WORK/'Owner.gd').write_text('''extends Node
var values: Dictionary
var source: String
var textures: Dictionary = {}
func get_texture(path: String) -> Texture2D:
    if not textures.has(path):
        var img := Image.load_from_file(source+"/"+path)
        assert(img != null, path)
        var texture := ImageTexture.create_from_image(img)
        texture.set_meta("source_path", path)
        textures[path] = texture
    return textures[path]
func _get(key: StringName) -> Variant:
    assert(values.has(key), "Costante mancante: "+str(key))
    var value: Variant = values.get(key)
    if value is Dictionary:
        if value.has("vector"): return Vector2(value.vector[0],value.vector[1])
        if value.has("texture"): return get_texture(value.texture)
    if value is float and value == floor(value): return int(value)
    if value is Array:
        return value.map(func(v): return int(v) if v is float and v == floor(v) else v)
    return value
''',encoding='utf-8')
(WORK/'Audit.gd').write_text('''extends SceneTree
func _initialize() -> void:
    call_deferred("run")
func snapshot(frames: SpriteFrames) -> Array:
    var result: Array = []
    for animation in frames.get_animation_names():
        if frames.get_frame_count(animation)==0: continue
        var cells: Array = []
        for i in frames.get_frame_count(animation):
            var texture: AtlasTexture = frames.get_frame_texture(animation,i)
            var r: Rect2 = texture.region
            cells.append({"sourcePath":texture.atlas.get_meta("source_path"), "rect":[r.position.x,r.position.y,r.size.x,r.size.y], "weight":frames.get_frame_duration(animation,i)})
        result.append({"animation":str(animation),"fps":frames.get_animation_speed(animation),"loop":frames.get_animation_loop(animation),"cells":cells})
    return result
func run() -> void:
    var who: String = OS.get_cmdline_user_args()[0]
    var config: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://"+who+".json"))
    var owner_node = load("res://Owner.gd").new()
    owner_node.values=config.values
    owner_node.source=config.source
    var sprite := AnimatedSprite2D.new()
    sprite.name="AnimatedSprite2D"
    owner_node.add_child(sprite)
    var front := AnimatedSprite2D.new()
    front.name="GrabFrontSprite"
    owner_node.add_child(front)
    root.add_child(owner_node)
    var script = load("res://"+who+"Catalog.gd")
    if script == null or not script.can_instantiate():
        quit(1)
        return
    var catalog = script.new(owner_node)
    var output: Array = []
    for function in config.functions:
        sprite.sprite_frames=SpriteFrames.new()
        front.sprite_frames=SpriteFrames.new()
        catalog.call(function)
        output.append({"function":function,"animations":snapshot(sprite.sprite_frames),"front":snapshot(front.sprite_frames)})
        sprite.sprite_frames=null
        front.sprite_frames=null
        owner_node.textures.clear()
    var file := FileAccess.open("res://"+who+"-runtime.json",FileAccess.WRITE)
    file.store_string(JSON.stringify(output,"  "))
    quit()
''',encoding='utf-8')

shared=(SOURCE/'scripts/IdleRosterFighter.gd').read_text(encoding='utf-8-sig')
defaults={}
for line in shared.splitlines():
    match=re.match(r'(?:const |@export(?:_range\([^)]*\))? var )(\w+)(?::\s*\w+)?\s*(?:(?::=|=)\s*(.*))?$',line.split('#')[0].strip())
    if not match: continue
    try: defaults[match[1]]=evaluate(match[2],defaults) if match[2] else None
    except (ValueError,KeyError,SyntaxError,TypeError): pass
setup=re.search(r'func _configure_animations\(\).*?(?=\nfunc |\Z)',shared,re.S)[0]
setup=setup.replace('\n\tupdate_sprite_scale()','')
for key in sorted(defaults,key=len,reverse=True):
    setup=re.sub(r'\b'+key+r'\b','fighter.'+key,setup)
helper=re.search(r'func _add_sheet_animation\(.*?(?=\nfunc |\Z)',shared,re.S)[0]
generic='''extends RefCounted
var fighter: Node
var animated_sprite: AnimatedSprite2D
func _init(owner: Node):
    fighter=owner
    animated_sprite=owner.get_node("AnimatedSprite2D")
'''+setup+'\n'+helper
for who in ['Bue','Mileto','Oscare','Peirolo','Torpe']:
    code=(SOURCE/'scenes'/(who+'.tscn')).read_text(encoding='utf-8-sig')
    values=dict(defaults)
    resources=dict((m[2],m[1]) for m in re.finditer(r'path="res://([^"]+)" id="([^"]+)"',code))
    for match in re.finditer(r'^(\w+) = (.*)$',code,re.M):
        if match[1] not in values: continue
        ref=re.match(r'ExtResource\("([^"]+)"\)',match[2])
        if ref:
            path=resources[ref[1]]
            if path.endswith('.png'): values[match[1]]=dict(texture=path)
        else:
            try: values[match[1]]=evaluate(match[2],values)
            except (ValueError,KeyError,SyntaxError,TypeError): pass
    (WORK/(who+'Catalog.gd')).write_text(generic.replace('\t','    '),encoding='utf-8')
    (WORK/(who+'.json')).write_text(json.dumps(dict(values=values,functions=['_configure_animations'],source=str(SOURCE).replace('\\','/'))),encoding='utf-8')

binary=Path(os.environ.get('GODOT_BIN') or shutil.which('godot') or 'C:/Program Files (x86)/Godot_v4.7-stable_win64.exe')
for who in ['Arianna','Mangler','Bue','Mileto','Oscare','Peirolo','Torpe']:
    result=subprocess.run([str(binary),'--headless','--log-file',str(WORK/(who+'-engine.log')),'--path',str(WORK),'--script','res://Audit.gd','--',who],capture_output=True,text=True,timeout=150)
    (WORK/(who+'-audit.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
    if result.returncode or 'SCRIPT ERROR' in result.stderr:
        raise RuntimeError(who+': '+result.stderr[-3500:])
    print(who+': catalogo runtime esportato in '+str(WORK/(who+'-runtime.json')))
