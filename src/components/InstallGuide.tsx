import { useState } from 'react';
import { installStateLabels } from '../features/install/installState';
import { useInstallPrompt } from '../features/install/useInstallPrompt';

interface InstallGuideProps {
  /** Heading level so the panel fits whatever page it is dropped into. */
  headingId?: string;
  compact?: boolean;
}

const iosSteps = [
  'SafariでNoodle Voyageを開きます',
  '共有ボタンを選びます',
  '「ホーム画面に追加」を選びます',
  '「Web Appとして開く」を有効にします',
  '「追加」を選びます'
];

/**
 * "アプリとして使う". Says only what the current browser can actually do: an
 * install button appears when a real prompt is waiting, iPhone gets the Safari
 * steps, and anything else gets a plain description rather than a promise.
 */
export function InstallGuide({ headingId = 'install-guide-title', compact = false }: InstallGuideProps) {
  const { state, needsSafari, promptInstall } = useInstallPrompt();
  const [result, setResult] = useState('');

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setResult('ホーム画面に追加しました。');
    else if (outcome === 'dismissed') setResult('追加をキャンセルしました。あとからでも追加できます。');
    else setResult('このブラウザーでは、いまは追加の確認を開けません。');
  };

  return (
    <section className={compact ? 'install-guide is-compact' : 'install-guide'} aria-labelledby={headingId}>
      <h2 id={headingId}>アプリとして使う</h2>
      <p>Noodle Voyageをホーム画面に追加すると、いつでもすぐに開けます。</p>
      <p className="install-state" role="status">{installStateLabels[state]}</p>

      {state === 'install_available' ? (
        <button type="button" className="button button-primary" onClick={() => void install()}>ホーム画面に追加</button>
      ) : null}
      {/* The answer stays on screen after the button has gone: a saved prompt
          can only be used once, so the button disappears as soon as it is. */}
      {result ? <p className="field-hint" role="status">{result}</p> : null}

      {state === 'ios_manual' ? (
        <div className="ios-steps">
          <h3>iPhoneに追加する</h3>
          {needsSafari ? <p className="field-error">Safariで開いてから追加してください</p> : null}
          <ol>
            {iosSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      ) : null}

      {state === 'unsupported' ? (
        <p className="field-hint">
          対応ブラウザーではインストールできます。iPhoneではSafariから追加できます。
          追加できない場合も、ブラウザーのブックマークからそのまま利用できます。
        </p>
      ) : null}

      <p className="method-note">
        ホーム画面に追加しても、記録はクラウドへ送信されません。記録はこの端末のブラウザー内に保存されます。
        端末やブラウザーのデータを削除すると、保存内容が失われる場合があります。定期的にバックアップしてください。
      </p>
    </section>
  );
}
