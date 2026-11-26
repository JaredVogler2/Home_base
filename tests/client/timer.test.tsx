import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GentleTimer } from '../../src/wall/scenes/GentleTimer';

/**
 * The mission timer is a help, never a hurry: a child starts it, it shows no numbers, and when it is full it
 * says so once and nothing else happens.
 */
describe('the gentle timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T08:00:00Z'));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('waits to be started, runs with no numbers, and says once when the time is up', () => {
    const onDone = vi.fn();
    render(<GentleTimer seconds={120} onDone={onDone} word />);
    const timer = screen.getByTestId('mission-timer');
    expect(timer.getAttribute('aria-label')).toBe('Timer: tap to start');
    expect(timer.getAttribute('data-state')).toBe('ready');

    // Nothing happens until a child starts it.
    act(() => void vi.advanceTimersByTime(5 * 60_000));
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(timer);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(timer.getAttribute('data-state')).toBe('running');
    expect(timer.getAttribute('aria-label')).toBe('Timer: running');
    // No countdown is shown or said: there is not a digit anywhere in it.
    expect(timer.textContent).toBe('Timer');
    expect(`${timer.textContent} ${timer.getAttribute('aria-label')}`).not.toMatch(/\d/);
    expect(onDone).not.toHaveBeenCalled();

    // A second tap while it runs does not start it over.
    fireEvent.click(timer);
    act(() => void vi.advanceTimersByTime(61_000));
    expect(timer.getAttribute('data-state')).toBe('full');
    expect(onDone).toHaveBeenCalledTimes(1);

    // Left alone, it says nothing more.
    act(() => void vi.advanceTimersByTime(10 * 60_000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can be started again when it is full', () => {
    const onDone = vi.fn();
    render(<GentleTimer seconds={30} onDone={onDone} />);
    const timer = screen.getByTestId('mission-timer');
    fireEvent.click(timer);
    act(() => void vi.advanceTimersByTime(31_000));
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.click(timer);
    expect(timer.getAttribute('data-state')).toBe('running');
    act(() => void vi.advanceTimersByTime(31_000));
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
