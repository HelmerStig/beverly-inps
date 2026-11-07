"""Durata comune del pugno leggero; conserva la sequenza e i timing Godot."""
from jump_timing import frames_hash


def apply_light_punch_timing(data, config):
    if config.get('schema') != 'sanmauro.light-punch-timing' or config.get('version') != 1:
        raise ValueError('Configurazione timing light-punch non valida')
    duration = config.get('durationMs')
    if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not 0 < duration <= 10000:
        raise ValueError('Durata light-punch non valida')
    impact_ms = config.get('impactMs')
    if not isinstance(impact_ms, (int, float)) or isinstance(impact_ms, bool) or not 0 < impact_ms < duration:
        raise ValueError('Tempo estensione light-punch non valido')
    entries = {item['characterId']: item for item in config['items']}
    if len(entries) != len(config['items']) or set(entries) != {c['id'] for c in data['characters']}:
        raise ValueError('Selezioni estensione incomplete o duplicate')
    for character in data['characters']:
        animation = next(a for a in character['animations'] if a['id'] == 'light-punch')
        count = len(animation['frames'])
        if not count:
            raise ValueError('Light-punch senza frame')
        entry = entries[character['id']]
        impact = entry['impactFrame']
        if entry['sourceSha256'] != animation['sourceSha256'] or entry['framesSha256'] != frames_hash(animation['frames']):
            raise ValueError('Rivedere estensione dopo cambio asset/taglio: ' + character['id'])
        if not isinstance(impact, int) or isinstance(impact, bool) or not 0 < impact < count:
            raise ValueError('Frame estensione fuori sequenza: ' + character['id'])
        if 'sourceFrameDurations' not in animation:
            animation['sourceFrameDurations'] = list(animation.get('frameDurations', [1000 / animation['sourceFps']] * count))
            animation['sourceDurationMs'] = sum(animation['sourceFrameDurations'])
        durations = [impact_ms / impact] * impact + [(duration - impact_ms) / (count - impact)] * (count - impact)
        animation.update(frameDurations=durations, durationMs=duration,
                         impactMs=impact_ms, impactFrame=impact, impactNote=entry.get('note', ''),
                         attackDurationMs=duration, playbackFps=count * 1000 / duration)
