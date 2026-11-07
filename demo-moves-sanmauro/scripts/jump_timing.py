"""Timing demo indipendente da Godot, vincolato a PNG e sequenze revisionate."""
import hashlib
import json


def frames_hash(frames):
    return hashlib.sha256(json.dumps(frames, separators=(',', ':')).encode()).hexdigest()


def apply_timing(data, timing):
    if timing.get('schema') != 'sanmauro.jump-timing' or timing.get('version') != 1:
        raise ValueError('Schema timing salto non valido')
    apex_ms, total_ms = timing['apexMs'], timing['durationMs']
    if not 0 < apex_ms < total_ms:
        raise ValueError('Durate salto non valide')
    entries = {item['characterId']: item for item in timing['items']}
    if len(entries) != len(timing['items']) or set(entries) != {c['id'] for c in data['characters']}:
        raise ValueError('Selezioni apice incomplete o duplicate')
    for character in data['characters']:
        animation = next(a for a in character['animations'] if a['id'] == 'jump')
        entry = entries[character['id']]
        count, apex = len(animation['frames']), entry['apexFrame']
        if (entry['sourceSha256'] != animation['sourceSha256'] or
                entry['framesSha256'] != frames_hash(animation['frames'])):
            raise ValueError(f'Rivedere apice dopo cambio asset/taglio: {character["id"]}')
        if not isinstance(apex, int) or not 0 < apex < count:
            raise ValueError(f'Apice fuori sequenza: {character["id"]}')
        # Mantiene il playback Godot come provenienza e rende la rigenerazione idempotente.
        for key in ('frameDurations', 'durationMs', 'takeoffMs'):
            source_key = 'source' + key[0].upper() + key[1:]
            if source_key not in animation:
                animation[source_key] = animation[key]
        durations = [apex_ms / apex] * apex + [(total_ms-apex_ms)/(count-apex)] * (count-apex)
        animation.update(frameDurations=durations, durationMs=total_ms,
            apexFrame=apex, apexMs=apex_ms, apexNote=entry.get('note', ''),
            takeoffMs=sum(durations[:animation['takeoffFrame']]),
            playbackFps=count*1000/total_ms)
