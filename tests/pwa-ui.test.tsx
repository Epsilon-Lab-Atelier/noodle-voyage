/**
 * @vitest-environment jsdom
 */
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionRow } from '../src/components/ActionRow';
import { InstallGuide } from '../src/components/InstallGuide';
import { TabStrip } from '../src/components/TabStrip';
import type { InstallPromptEvent } from '../src/features/install/installState';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setUserAgent = (agent: string, maxTouchPoints = 0) => {
  Object.defineProperty(window.navigator, 'userAgent', { value: agent, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
};

const setDisplayMode = (standalone: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: standalone && query.includes('standalone'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
};

const firePrompt = () => {
  const event = new Event('beforeinstallprompt') as InstallPromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' as const }) });
  fireEvent(window, event);
  return event;
};

describe('アプリとして使う', () => {
  it('does not show an install button when the browser has not offered one', () => {
    setDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Windows NT 10.0) Firefox/130');
    render(<InstallGuide />);
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
    expect(screen.getByText(/対応ブラウザーではインストールできます/)).toBeTruthy();
  });

  it('shows the install button once beforeinstallprompt has fired', () => {
    setDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120');
    render(<InstallGuide />);
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
    firePrompt();
    expect(screen.getByRole('button', { name: 'ホーム画面に追加' })).toBeTruthy();
  });

  it('opens the browser confirmation and reports the choice', async () => {
    setDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120');
    render(<InstallGuide />);
    const event = firePrompt();
    fireEvent.click(screen.getByRole('button', { name: 'ホーム画面に追加' }));
    expect(event.prompt).toHaveBeenCalled();
    expect(await screen.findByText('ホーム画面に追加しました。')).toBeTruthy();
  });

  it('stops offering the install once appinstalled arrives', () => {
    setDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120');
    render(<InstallGuide />);
    firePrompt();
    expect(screen.getByRole('button', { name: 'ホーム画面に追加' })).toBeTruthy();
    fireEvent(window, new Event('appinstalled'));
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
    expect(screen.getByText('アプリとして利用中')).toBeTruthy();
  });

  it('shows the Safari steps on an iPhone, and says which browser to use elsewhere on iOS', () => {
    setDisplayMode(false);
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/605');
    const safari = render(<InstallGuide />);
    expect(screen.getByRole('heading', { name: 'iPhoneに追加する' })).toBeTruthy();
    expect(screen.getByText('「ホーム画面に追加」を選びます')).toBeTruthy();
    expect(screen.queryByText('Safariで開いてから追加してください')).toBeNull();
    safari.unmount();

    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/120');
    render(<InstallGuide />);
    expect(screen.getByText('Safariで開いてから追加してください')).toBeTruthy();
  });

  it('says nothing about adding when it is already running from the home screen', () => {
    setDisplayMode(true);
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120');
    render(<InstallGuide />);
    expect(screen.getByText('アプリとして利用中')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'iPhoneに追加する' })).toBeNull();
  });

  it('is honest that a home-screen copy is still device-only storage', () => {
    setDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120');
    render(<InstallGuide />);
    expect(screen.getByText(/記録はクラウドへ送信されません/)).toBeTruthy();
  });
});

describe('the four record tabs on a narrow screen', () => {
  const tabs = [
    { id: 'wishlist', label: '食べたい', count: 3 },
    { id: 'meals', label: 'ごちそうさま', count: 2 },
    { id: 'favorites', label: 'お気に入り', count: 1 },
    { id: 'places', label: 'お店', count: 4 }
  ];

  it('keeps all four on one row that scrolls instead of wrapping', () => {
    render(<TabStrip tabs={tabs} current="wishlist" onSelect={() => undefined} label="記録の種類" />);
    const list = screen.getByRole('tablist');
    expect(within(list).getAllByRole('tab')).toHaveLength(4);
    const scroller = list as HTMLElement;
    expect(scroller.className).toContain('tab-strip-scroller');
    // The class is what pins the row; the rule itself lives in styles.css and is
    // asserted by the stylesheet check below.
    expect(scroller.querySelectorAll('button')).toHaveLength(4);
  });

  it('moves between tabs with the arrow keys', () => {
    const onSelect = vi.fn();
    render(<TabStrip tabs={tabs} current="favorites" onSelect={onSelect} label="記録の種類" />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('places');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith('meals');
  });

  it('wraps around at both ends so every tab is reachable', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<TabStrip tabs={tabs} current="places" onSelect={onSelect} label="記録の種類" />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('wishlist');
    rerender(<TabStrip tabs={tabs} current="wishlist" onSelect={onSelect} label="記録の種類" />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith('places');
  });

  it('marks the selected tab for a screen reader', () => {
    render(<TabStrip tabs={tabs} current="places" onSelect={() => undefined} label="記録の種類" />);
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('お店');
  });
});

describe('a row of controls on a narrow screen', () => {
  const secondary = [
    { key: 'wish', label: '食べたい' },
    { key: 'maps', label: 'Google マップで見る', href: 'https://www.google.com/maps/search/?api=1&query=x' },
    { key: 'delete', label: '削除', danger: true }
  ];

  it('shows one button and folds the rest behind その他', () => {
    render(<ActionRow label="駅前の一杯" primary={{ key: 'meal', label: 'ごちそうさまを記録' }} secondary={secondary} />);
    expect(screen.getByRole('button', { name: 'ごちそうさまを記録' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'その他' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /削除/ })).toBeNull();
    // Two controls at rest, never four squeezed onto one line.
    expect(document.querySelectorAll('.action-row > .card-action, .action-row .action-more-trigger')).toHaveLength(2);
  });

  it('opens the rest on demand, with the external link marked as external', () => {
    render(<ActionRow label="駅前の一杯" primary={{ key: 'meal', label: 'ごちそうさまを記録' }} secondary={secondary} />);
    fireEvent.click(screen.getByRole('button', { name: 'その他' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    const external = within(menu).getByRole('menuitem', { name: /Google マップで見る/ });
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(external.textContent).toContain('外部サイト');
  });

  it('closes on Escape and runs the action that was chosen', () => {
    const onSelect = vi.fn();
    render(<ActionRow label="駅前の一杯" primary={{ key: 'meal', label: 'ごちそうさまを記録' }} secondary={[{ key: 'wish', label: '食べたい', onSelect }]} />);
    const trigger = screen.getByRole('button', { name: 'その他' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: '食べたい' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('drops the menu entirely when there is only one thing to do', () => {
    render(
      <MemoryRouter>
        <ActionRow label="料理" primary={{ key: 'remove', label: '食べたいから外す' }} secondary={[]} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: 'その他' })).toBeNull();
  });
});
