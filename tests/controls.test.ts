import { describe, it, expect } from 'vitest';
import { actionFor, bindKey, unbindKey, resetBindings, prefs, keyName, setMasterVolume } from '../src/systems/controls';

describe('comandi personalizzabili', () => {
  it('ha i tasti predefiniti', () => {
    resetBindings();
    expect(actionFor('KeyZ')).toBe('a');
    expect(actionFor('KeyX')).toBe('b');
    expect(actionFor('Escape')).toBe('settings');
    expect(actionFor('KeyO')).toBeUndefined();
  });
  it('riassegna un tasto e lo toglie dal comando che lo usava', () => {
    resetBindings();
    const stolen = bindKey('a', 0, 'KeyM');
    expect(stolen).toBe('menu');
    expect(actionFor('KeyM')).toBe('a');
    expect(actionFor('KeyZ')).toBeUndefined();
    expect(prefs.keys.menu).toEqual([]);
    unbindKey('a', 0);
    expect(actionFor('KeyM')).toBeUndefined();
    resetBindings();
  });
  it('nomi leggibili e volume limitato', () => {
    expect(keyName('KeyQ')).toBe('Q');
    expect(keyName('Enter')).toBe('Invio');
    setMasterVolume(2); expect(prefs.volume).toBe(1);
    setMasterVolume(-1); expect(prefs.volume).toBe(0);
  });
});
