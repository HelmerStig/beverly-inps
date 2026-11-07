"""Durata comune delle reazioni, senza modificare sequenze e timing sorgenti."""


def apply_hurt_timing(data, config):
    ids = ['hurt-high','hurt-medium','hurt-low','hurt-crouched']
    if config.get('schema')!='sanmauro.hurt-timing' or config.get('version')!=1 or config.get('animationIds')!=ids:
        raise ValueError('Configurazione timing hurt non valida')
    duration = config.get('durationMs')
    if not isinstance(duration,(int,float)) or isinstance(duration,bool) or not 0 < duration <= 10000:
        raise ValueError('Durata hurt non valida')
    for character in data['characters']:
        for ident in ids:
            animation=next(a for a in character['animations'] if a['id']==ident)
            count=len(animation['frames'])
            if not count:
                raise ValueError('Hurt senza frame')
            if 'sourceFrameDurations' not in animation:
                animation['sourceFrameDurations']=list(animation['frameDurations'])
                animation['sourceDurationMs']=sum(animation['sourceFrameDurations'])
            animation.update(frameDurations=[duration/count]*count,durationMs=duration,
                reactionDurationMs=duration,playbackFps=count*1000/duration)
