'use client';

import { APP_ERROR_MESSAGE } from '@/lib/app-error-constants';

interface ErrorProps {
  unstable_retry: () => void;
}

export default function Error({ unstable_retry }: ErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-950">{APP_ERROR_MESSAGE.TITLE}</h1>
      <p className="mt-3 text-slate-600">{APP_ERROR_MESSAGE.UNEXPECTED}</p>
      <button
        className="mt-6 w-fit rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white"
        type="button"
        onClick={unstable_retry}
      >
        다시 시도
      </button>
    </main>
  );
}
