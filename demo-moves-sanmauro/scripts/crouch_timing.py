"""Ingresso in accovacciata con durata comune, mantenendo i dati Godot."""


def apply_crouch_timing(data, config):
    if config.get('schema')!='sanmauro.crouch-timing' or config.get('version')!=1:
        raise ValueError('Configurazione timing crouch non valida')
    duration=config.get('durationMs')
    if not isinstance(duration,(int,float)) or isinstance(duration,bool) or not 0<duration<=10000:
        raise ValueError('Durata crouch non valida')
    for character in data['characters']:
        animation=next(a for a in character['animations'] if a['id']=='crouch')
        count=len(animation['frames'])
        if not count:
            raise ValueError('Crouch senza frame')
        if 'sourceFrameDurations' not in animation:
            animation['sourceFrameDurations']=list(animation.get('frameDurations',[1000/animation['sourceFps']]*count))
            animation['sourceDurationMs']=sum(animation['sourceFrameDurations'])
        animation.update(frameDurations=[duration/count]*count,durationMs=duration,
            poseDurationMs=duration,playbackFps=count*1000/duration)
