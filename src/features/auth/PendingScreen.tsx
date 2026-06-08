import { useAuth } from "../../store/AuthProvider";

export function PendingScreen() {
  const { profile, signOut, refreshProfile } = useAuth();

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">공기수비대</div>
          <h1 className="mt-1 text-lg font-semibold">승인 대기 중</h1>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="text-amber-800 dark:text-amber-200">
            <strong>{profile?.email}</strong> 으로 로그인하셨습니다.
          </p>
          <p className="mt-2 text-amber-700 dark:text-amber-300">
            관리자가 가입을 승인하면 앱을 사용할 수 있어요.
            <br />
            승인 후 아래 "새로고침" 을 눌러주세요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={refreshProfile}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
