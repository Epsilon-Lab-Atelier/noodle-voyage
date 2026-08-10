/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const updateServiceWorker = vi.fn();
const setNeedRefresh = vi.fn();
let needRefresh = true;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker
  })
}));

const { UpdatePrompt } = await import('../src/components/UpdatePrompt');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  needRefresh = true;
});

describe('the new-version notice', () => {
  it('says what will happen to the reader\'s records', () => {
    render(<UpdatePrompt />);
    expect(screen.getByText('新しいバージョンがあります')).toBeTruthy();
    expect(screen.getByText('保存した記録はそのまま引き継がれます。')).toBeTruthy();
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe('update-prompt-title');
  });

  it('stays out of the way until there is a version waiting', () => {
    needRefresh = false;
    render(<UpdatePrompt />);
    expect(screen.queryByText('新しいバージョンがあります')).toBeNull();
  });

  it('reloads on 更新する when nothing is half-typed', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: '更新する' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    confirm.mockRestore();
  });

  it('asks first when a form still holds unsaved text, and obeys a refusal', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <>
        <form><input defaultValue="入力途中の店名" /></form>
        <UpdatePrompt />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: '更新する' }));
    expect(confirm).toHaveBeenCalled();
    expect(updateServiceWorker).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '更新する' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    confirm.mockRestore();
  });

  it('closes on あとで and on Escape without reloading', () => {
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'あとで' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();

    setNeedRefresh.mockClear();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('never clears stored records itself', () => {
    render(<UpdatePrompt />);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '更新する' }));
    // The only thing it does is ask the waiting worker to take over.
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    confirm.mockRestore();
  });
});
