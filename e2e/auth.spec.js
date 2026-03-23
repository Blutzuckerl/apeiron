const { test } = require('@playwright/test');
const { expect, uniqueName } = require('./helpers');

test.describe('Auth E2E', () => {
  test('registration keeps inputs on invalid password', async ({ page }) => {
    const handle = uniqueName('authbad');
    const form = {
      email: `${handle}@apeiron.app`,
      displayName: `Auth ${handle}`,
      username: handle,
      dateOfBirth: '1990-04-12',
      password: 'short7'
    };

    await page.goto('/register');
    await page.getByTestId('register-email-input').fill(form.email);
    await page.getByTestId('register-display-name-input').fill(form.displayName);
    await page.getByTestId('register-username-input').fill(form.username);
    await page.getByTestId('register-dob-input').fill(form.dateOfBirth);
    await page.getByTestId('register-password-input').fill(form.password);
    await page.getByTestId('register-policy-input').check();
    await page.getByTestId('register-submit').click();

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId('register-password-error')).toContainText(/mindestens 8 zeichen/i);
    await expect(page.getByTestId('register-email-input')).toHaveValue(form.email);
    await expect(page.getByTestId('register-display-name-input')).toHaveValue(form.displayName);
    await expect(page.getByTestId('register-username-input')).toHaveValue(form.username);
    await expect(page.getByTestId('register-dob-input')).toHaveValue(form.dateOfBirth);
    await expect(page.getByTestId('register-password-input')).toHaveValue(form.password);
  });

  test('valid registration lands in app', async ({ page }) => {
    const handle = uniqueName('authok');

    await page.goto('/register');
    await page.getByTestId('register-email-input').fill(`${handle}@apeiron.app`);
    await page.getByTestId('register-display-name-input').fill(`Auth ${handle}`);
    await page.getByTestId('register-username-input').fill(handle);
    await page.getByTestId('register-dob-input').fill('1993-07-19');
    await page.getByTestId('register-password-input').fill('Apeiron123!');
    await page.getByTestId('register-policy-input').check();
    await page.getByTestId('register-submit').click();

    await page.waitForURL(/\/app\/home/);
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();
  });

  test('login shows an error for a wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier-input').fill('einstein');
    await page.getByTestId('login-password-input').fill('definitely-wrong');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-inline-error')).toContainText(/falsches passwort/i);
    await expect(page.getByTestId('login-identifier-input')).toHaveValue('einstein');
  });

  test('valid login redirects to DM home', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier-input').fill('einstein');
    await page.getByTestId('login-password-input').fill('apeiron123!');
    await page.getByTestId('login-submit').click();

    await page.waitForURL(/\/app\/home/);
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();
  });
});
