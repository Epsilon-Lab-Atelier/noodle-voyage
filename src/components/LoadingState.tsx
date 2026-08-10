export function LoadingState({ message = '麺料理のデータを読み込んでいます。' }: { message?: string }) {
  return (
    <div className="status-panel" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="status-panel error-panel" role="alert">
      <h2>読み込みに失敗しました</h2>
      <p>{message}</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>再読み込み</button>
    </div>
  );
}
