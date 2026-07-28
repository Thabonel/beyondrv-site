import { expect, test } from '@playwright/test';

async function installSpeechRecognitionStub(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    class SpeechRecognitionStub {
      static current: SpeechRecognitionStub | null = null;
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;

      constructor() {
        SpeechRecognitionStub.current = this;
      }

      start() {
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: SpeechRecognitionStub,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: SpeechRecognitionStub,
    });
    Object.assign(window, {
      __speechRecognitionTest: {
        result(transcript: string) {
          SpeechRecognitionStub.current?.onresult?.({
            resultIndex: 0,
            results: Object.assign([
              Object.assign([{ transcript }], { isFinal: true }),
            ], { length: 1 }),
          });
          SpeechRecognitionStub.current?.onend?.();
        },
        error(error: string) {
          SpeechRecognitionStub.current?.onerror?.({ error });
          SpeechRecognitionStub.current?.onend?.();
        },
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/.netlify/functions/admin-products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: [] }),
  }));
});

test('voice input appends an editable transcript without sending it', async ({ page }) => {
  await installSpeechRecognitionStub(page);
  let chatRequests = 0;
  await page.route('**/.netlify/functions/admin-chat', route => {
    chatRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: 'Unexpected send', pendingChanges: [] }),
    });
  });

  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Chat' }).click();
  const input = page.getByTestId('admin-chat-input');
  await input.fill('Please');
  await page.getByTestId('admin-chat-voice-button').click();
  await expect(page.getByTestId('admin-chat-voice-button')).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => {
    (window as typeof window & { __speechRecognitionTest: { result: (transcript: string) => void } })
      .__speechRecognitionTest.result('put the Advent camper on special');
  });

  await expect(input).toHaveValue('Please put the Advent camper on special');
  await expect(page.getByTestId('admin-chat-voice-status')).toContainText('Review or edit it');
  expect(chatRequests).toBe(0);

  await input.fill('Please put the Advent camper on a weekend special');
  await expect(input).toHaveValue('Please put the Advent camper on a weekend special');
  expect(chatRequests).toBe(0);
});

test('voice input explains microphone permission denial and keeps typing available', async ({ page }) => {
  await installSpeechRecognitionStub(page);
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Chat' }).click();
  await page.getByTestId('admin-chat-voice-button').click();

  await page.evaluate(() => {
    (window as typeof window & { __speechRecognitionTest: { error: (error: string) => void } })
      .__speechRecognitionTest.error('not-allowed');
  });

  await expect(page.getByTestId('admin-chat-voice-status')).toContainText('Microphone permission was denied');
  await expect(page.getByTestId('admin-chat-input')).toBeEditable();
  await page.getByTestId('admin-chat-input').fill('Typing still works');
  await expect(page.getByTestId('admin-chat-input')).toHaveValue('Typing still works');
});

test('unsupported browsers show a clear typing fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
  });

  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Chat' }).click();

  await expect(page.getByTestId('admin-chat-voice-button')).toBeDisabled();
  await expect(page.getByTestId('admin-chat-voice-status')).toContainText('not supported by this browser');
  await expect(page.getByTestId('admin-chat-voice-status')).toContainText('keep typing');
  await expect(page.getByTestId('admin-chat-input')).toBeEditable();
});
