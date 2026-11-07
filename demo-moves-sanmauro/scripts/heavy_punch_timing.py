"""Durata comune del pugno pesante; conserva la sequenza e i timing Godot."""
from jump_timing import frames_hash


def apply_heavy_punch_timing(data, config):
    if config.get('schema') != 'sanmauro.heavy-punch-timing' or config.get('version') != 1:
        raise ValueError('Configurazione timing heavy-punch non valida')
    duration = config.get('durationMs')
    if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not 0 < duration <= 10000:
        raise ValueError('Durata heavy-punch non valida')
    impact_ms = config.get('impactMs')
    if not isinstance(impact_ms, (int, float)) or isinstance(impact_ms, bool) or not 0 < impact_ms < duration:
        raise ValueError('Tempo estensione heavy-punch non valido')
    entries = {item['characterId']: item for item in config['items']}
    if len(entries) != len(config['items']) or set(entries) != {c['id'] for c in data['characters']}:
        raise ValueError('Selezioni estensione incomplete o duplicate')
    for character in data['characters']:
        animation = next(a for a in character['animations'] if a['id'] == 'heavy-punch')
        count = len(animation['frames'])
        if not count:
            raise ValueError('Pugno pesante senza frame')
        entry = entries[character['id']]
        impact = entry['impactFrame']
        if entry['sourceSha256'] != animation['sourceSha256'] or entry['framesSha256'] != frames_hash(animation['frames']):
            raise ValueError('Rivedere estensione dopo cambio asset/taglio: ' + character['id'])
        if not isinstance(impact, int) or isinstance(impact, bool) or not 0 < impact < count-1:
            raise ValueError('Frame estensione fuori sequenza: ' + character['id'])
        if 'sourceFrameDurations' not in animation:
            animation['sourceFrameDurations'] = list(animation.get('frameDurations', [1000 / animation['sourceFps']] * count))
            animation['sourceDurationMs'] = sum(animation['sourceFrameDurations'])
        durations = [impact_ms / impact] * impact + [(duration - impact_ms) / (count - impact - 1)] * (count - impact - 1) + [0]
        animation.update(frameDurations=durations, durationMs=duration,
                         returnToIdleMs=duration, impactMs=impact_ms, impactFrame=impact, impactNote=entry.get('note', ''),
                         attackDurationMs=duration, playbackFps=count * 1000 / duration)
